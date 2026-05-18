# Plan de implementación — Soft cap de puntos por cliente/restaurante

> Estado: **borrador para validación**. No iniciar implementación hasta confirmación del usuario.
>
> Fecha: 2026-05-16
>
> Autor: Claude (Opus 4.7)
>
> Dependencia: este plan **se implementa después** de [[PLAN_LEALTAD_PUNTOS]] (F1–F6).

---

## 1. Resumen ejecutivo

El sistema base de lealtad ya define `RestaurantLoyaltySetting` con `is_active`, `currency_unit_amount`, `points_earned`. Este plan agrega **dos reglas de negocio adicionales** que protegen el saldo del cliente y evitan que la lealtad se vuelva una "máquina infinita":

1. **Soft cap por cliente/restaurante**: el dueño define un **tope máximo de puntos acumulados** que un cliente puede tener en su restaurante. Cuando una compra otorgaría puntos que sobrepasarían el tope:
   - Se asigna **solo la cantidad necesaria para llenar el tope** (relleno parcial).
   - Se **notifica al cliente** que llegó al tope y que se le sugiere canjear esos puntos en productos habilitados.
2. **No se gana al canjear**: si el cliente aplicó canje de puntos en un pedido (con descuento), **esa orden no genera puntos** (ni siquiera por el monto no descontado), para evitar el ciclo "canjeo y vuelvo a ganar".

Ambas reglas son **opt-in por restaurante** (el dueño configura el tope; si lo deja vacío, no hay soft cap).

---

## 2. Decisiones (asumidas — confirmar en sección 6)

| # | Decisión | Default propuesto |
|---|---|---|
| 1 | Campo de tope | `max_customer_points_balance` (PositiveIntegerField) en `RestaurantLoyaltySetting`. **Obligatorio cuando `is_active=True`**. |
| 2 | Relleno parcial | Si el cliente tiene `current_points = 998` y el tope es `1000`, una compra que daría 10 puntos suma **2**, no 10. |
| 3 | Trigger del cap | Se evalúa **al asignar puntos** (`assign_points_for_order`), no al canjear. |
| 4 | Notificación de cap | Persistida en `LoyaltyTransaction` (campos nuevos `points_uncapped` y `cap_applied`) + WebSocket al cliente (`loyalty.cap_reached`) con anti-spam de 24h. Tipo nuevo de transacción `earned_purchase_capped`. |
| 5 | Sin puntos por canje aplicado | El canje se aplica **a un ítem específico**. Solo ese ítem no genera puntos; el resto de ítems de la orden sí los generan proporcionalmente. |
| 6 | Caso "cap exacto" | Si la compra llena exactamente el tope (`current + delta == max`), se asigna delta completo y la notificación es informativa. |
| 7 | Caso "ya en tope" | Si `current_points >= max` antes de la compra, no se crea transacción de ganancia. Notificación recordatoria si ha pasado >24h desde la última. |
| 8 | UX cliente | En `/dashboard/cliente/puntos` mostrar indicador "X de Y puntos del tope" y banner si está en cap. |
| 9 | UX restaurante | En la tab "Configuración" de lealtad, input `max_customer_points_balance` con validador "no puede bajar del saldo del cliente con más puntos". |
| 10 | Validación de baja del tope | El dueño puede subir libremente. Para bajar: `new_value >= max(current_points) de los LoyaltyAccount de ese restaurante`. De lo contrario, `ValidationError` con mensaje claro. |
| 11 | Migración de cuentas existentes | No aplica: como el tope es obligatorio desde la activación, no existe escenario "activé después y hay clientes con saldo mayor". |

---

## 3. Cambios en el backend

### 3.1 Modelo

**Archivo:** `backend/apps/loyalty/models.py`

1. `RestaurantLoyaltySetting`
   - Agregar: `max_customer_points_balance = PositiveIntegerField(null=True, blank=True)`
     - Es **obligatorio** cuando `is_active=True` (validación a nivel `clean()` y serializer).
     - Cuando `is_active=False`, puede ser null (el setting aún no se usa).
     - Validación adicional en `save()`: si se está **bajando** el valor, debe ser `>= max(current_points)` entre los `LoyaltyAccount` de ese restaurante. Si no, `ValidationError("No puedes bajar el tope por debajo del cliente con más puntos (X puntos)")`.

2. `LoyaltyTransaction` — persistir auditoría detallada:
   - `points_uncapped = PositiveIntegerField(null=True, blank=True)` — cuántos puntos se habrían otorgado sin tope.
   - `cap_applied = BooleanField(default=False)` — flag rápido para filtrar transacciones cappeadas.

**Migración:** `loyalty/000X_soft_cap_fields.py`

### 3.2 Catálogo de tipos de transacción

**Archivo:** seed/`post_migrate` de loyalty (o donde se carguen los `tx_type`).

Nuevo tipo: `earned_purchase_capped` (`name="Puntos parciales por tope"`, `direction=+1`).

### 3.3 Servicio `assign_points_for_order`

**Archivo:** `backend/apps/loyalty/services.py`

Lógica nueva (pseudocódigo):

```python
def assign_points_for_order(order):
    setting = RestaurantLoyaltySetting.objects.filter(
        restaurant=order.restaurant, is_active=True
    ).first()
    if not setting or setting.currency_unit_amount <= 0:
        return

    # Calcular base elegible: total del pedido MENOS los ítems con canje aplicado
    redemption_item_ids = set(
        order.loyalty_redemptions
        .filter(status="applied")
        .values_list("order_item_id", flat=True)
    )
    eligible_amount = sum(
        item.subtotal for item in order.items.all()
        if item.id not in redemption_item_ids
    )
    if eligible_amount <= 0:
        return  # toda la orden fue canjeada, no hay base para ganar

    account, _ = LoyaltyAccount.objects.get_or_create(
        user=order.user, restaurant=order.restaurant
    )

    units = int(eligible_amount / setting.currency_unit_amount)
    delta_uncapped = units * setting.points_earned
    if setting.max_points_per_order:
        delta_uncapped = min(delta_uncapped, setting.max_points_per_order)

    # Soft cap por saldo
    cap = setting.max_customer_points_balance
    room = max(cap - account.current_points, 0)
    delta = min(delta_uncapped, room)
    cap_applied = delta < delta_uncapped

    if delta > 0:
        tx_code = "earned_purchase_capped" if cap_applied else "earned_purchase"
        LoyaltyTransaction.objects.create(
            account=account,
            tx_type=TxType.objects.get(code=tx_code),
            points_delta=delta,
            points_uncapped=delta_uncapped if cap_applied else None,
            cap_applied=cap_applied,
            order=order,
        )
        account.current_points = F("current_points") + delta
        account.lifetime_points = F("lifetime_points") + delta
        account.save()
        account.refresh_from_db()

    # Notificación: emitir si cap se aplicó, o si ya estaba en tope (respetando anti-spam 24h)
    needs_reminder = (
        cap_applied
        or (delta == 0 and account.current_points >= cap)
    )
    if needs_reminder and not _cap_notified_recently(account, hours=24):
        notify_cap_reached(account, order, awarded=delta, uncapped=delta_uncapped, setting=setting)
```

Notas:
- **Base elegible:** se excluyen los `subtotal` de los `OrderItem` que aparecen en `LoyaltyRedemption.order_item` con `status=applied`. Solo el ítem canjeado pierde su ganancia; el resto de la orden mantiene su proporción de puntos.
  - Requiere que `LoyaltyRedemption` tenga campo `order_item = ForeignKey('orders.OrderItem', null=True, on_delete=SET_NULL)`. Si en el plan principal solo se modeló a nivel de orden, agregar este campo en una migración.
- `lifetime_points` solo aumenta por los puntos efectivamente otorgados (no por `delta_uncapped`).
- Cuando `current_points >= cap` antes de la compra (`room=0`), no se crea transacción de ganancia.
- Anti-spam: `_cap_notified_recently(account, hours=24)` revisa la última notificación tipo `cap_reached` por cliente+restaurante; si fue <24h, omite.

### 3.4 Notificación `notify_cap_reached`

**Archivo:** `backend/apps/loyalty/signals.py` (o servicio dedicado).

- Envía un evento WebSocket `loyalty.cap_reached` al canal privado del cliente:
  ```json
  {
    "type": "loyalty.cap_reached",
    "restaurant_id": "...",
    "restaurant_name": "...",
    "current_points": 1000,
    "max_balance": 1000,
    "awarded_this_order": 2,
    "would_have_awarded": 10,
    "message": "Llegaste al tope de puntos en {restaurante}. Te recomendamos canjearlos en los productos habilitados."
  }
  ```
- Hook idéntico al patrón existente (`loyalty.points_earned`, `loyalty.tier_upgraded`).

### 3.5 Reversión al cancelar

**Archivo:** `backend/apps/loyalty/services.py` → `revert_points_for_order(order)`

- Si la transacción original era `earned_purchase_capped`, igual se revierte por el delta realmente otorgado (no por el `delta_uncapped`).
- Si la orden tenía canje aplicado y fue cancelada, **devolver los puntos canjeados** al saldo del cliente (transacción `redeem_reverted`), respetando el soft cap (si al devolver se pasaría del tope, devolver solo hasta el tope y registrar diferencia — necesita confirmación, ver Q5).

### 3.6 Serializers

**Archivo:** `backend/apps/loyalty/api/serializers.py`

- `RestaurantLoyaltySettingSerializer`: incluir `max_customer_points_balance`. Validar `> 0` si no es null.
- `CustomerLoyaltyAccountSerializer`: exponer `max_customer_points_balance` y `current_points` para que el frontend muestre el indicador de cap.

### 3.7 API

No requiere endpoints nuevos: solo extiende el setting endpoint ya planificado en F1 de [[PLAN_LEALTAD_PUNTOS]].

---

## 4. Cambios en el frontend

### 4.1 UI restaurante — tab Configuración (de la página `lealtad.jsx`)

Agregar campo:
- **Input** `max_customer_points_balance` (numérico, opcional).
  - Label: "Tope máximo de puntos por cliente".
  - Tooltip: "Cantidad máxima de puntos que un cliente puede acumular en tu restaurante. Cuando alcanza este tope, no recibirá más puntos hasta que canjee."
  - Vacío = sin tope.

### 4.2 UI cliente — `pages/dashboard/cliente/puntos.jsx`

1. Si `data.max_customer_points_balance` existe:
   - Mostrar barra de progreso `current_points / max_balance`.
   - Etiqueta: "1.000 / 2.000 puntos en {restaurante}".
2. Si `current_points >= max_balance`:
   - Mostrar banner amarillo:
     "Llegaste al tope de puntos en {restaurante}. Canjéalos en los productos habilitados para seguir acumulando."
3. Suscribirse al evento WebSocket `loyalty.cap_reached` para mostrar toast inmediato:
   - "Esta compra te dio 2 puntos en vez de 10 porque llegaste al tope. ¡Canjea para liberar espacio!"

**Archivo:** `frontend/src/hooks/use-customer-loyalty-socket.js` (nuevo o extender el existente para órdenes).

### 4.3 UI cliente — checkout

Cuando el cliente aplique un canje en checkout, mostrar nota:
- "Recuerda: las compras con canje aplicado no generan puntos."

### 4.4 Notificación visual en historial de transacciones

- En la tab "Canjes" / "Historial" del cliente, las transacciones `earned_purchase_capped` deben renderizarse con un badge "Parcial (tope)" para que el cliente entienda por qué su compra dio menos de lo esperado.

---

## 5. Tests

### 5.1 Backend (`pytest`)

**Archivo:** `apps/loyalty/tests/test_soft_cap.py`

| Caso | Setup | Asserts |
|---|---|---|
| Activar sin tope | `is_active=True`, `max_customer_points_balance=None` | `ValidationError` en serializer |
| Tope = 0 | `max=0` | `ValidationError` |
| Bajar tope debajo del cliente top | `max=1000` con cliente que tiene 800; bajar a 700 | `ValidationError("No puedes bajar el tope por debajo de 800")` |
| Bajar tope válido | `max=1000` con cliente top en 500; bajar a 600 | Permitido |
| Subir tope | `max=1000` → `max=2000` | Permitido sin chequeos |
| Tope con espacio suficiente | `max=1000`, `current=500`, compra otorga 100 | `current==600`, `tx_type=earned_purchase`, `cap_applied=False` |
| Tope con espacio parcial | `max=1000`, `current=998`, compra otorga 10 | `current==1000`, `tx_type=earned_purchase_capped`, `points_uncapped=10`, `cap_applied=True`, notificación emitida |
| Tope exacto al llenar | `max=1000`, `current=990`, compra otorga 10 | `current==1000`, `tx_type=earned_purchase`, notificación emitida (informativa) |
| Cliente ya en tope | `max=1000`, `current=1000`, compra que daría 10 | No se crea transacción de ganancia; notificación recordatoria si >24h |
| Anti-spam de notificación | dos compras seguidas en tope | Segunda compra no emite notificación |
| Orden con canje en 1 de 5 ítems | order_items = [10k,10k,10k,10k,10k], canje sobre item[0] | Base elegible = 40k; puntos según 40k (excluye 10k del ítem canjeado) |
| Orden 100% canjeada | toda la orden con redemption por ítem | `delta=0`, no se crea transacción |
| Cancelación de orden capped | revertir solo lo realmente otorgado | `current` baja por `delta`, no por `delta_uncapped` |
| Reversión de canje rebasa tope | devolver canje cuando saldo + canje > max | (ver Q1 sección 6) |
| `lifetime_points` con cap | compra capped | `lifetime_points` aumenta solo por `delta`, no por `delta_uncapped` |

### 5.2 Frontend (Vitest)

- `puntos.jsx`: render con `max_customer_points_balance` mostrando barra; sin él, sin barra.
- Banner "llegaste al tope" cuando `current >= max`.
- Toast al recibir evento `loyalty.cap_reached`.

### 5.3 E2E (Playwright)

**Archivo:** `frontend/e2e/loyalty-soft-cap.spec.js`

1. Dueño activa programa con tope = 100.
2. Dueño intenta bajar el tope a 30 con un cliente que tiene 50 → error.
3. Cliente hace compra que da 60 puntos → tiene 60.
4. Cliente hace compra que daría 80 puntos → solo se suman 40, ve banner y toast.
5. Cliente intenta otra compra → no recibe puntos (recordatorio sale solo si >24h).
6. Cliente canjea 50 puntos → saldo 50.
7. Cliente hace nueva compra → vuelve a recibir puntos.
8. Cliente aplica canje sobre 1 de 3 ítems en una compra → recibe puntos solo por los otros 2 ítems.

---

## 6. Decisiones validadas y preguntas restantes

### Validadas

| # | Decisión |
|---|---|
| Alcance del bloqueo de ganancia | El canje **solo** afecta al ítem canjeado. El resto de ítems de la orden generan puntos proporcionalmente |
| Auditoría del cap | Persistir en DB: `points_uncapped` y `cap_applied` en `LoyaltyTransaction` |
| Notificación cuando ya estaba en tope | Toast con anti-spam (>24h desde la última notificación de cap a ese cliente+restaurante) |
| Tope obligatorio | El tope es **obligatorio** al activar el programa de recompensas (`is_active=True` ⇒ `max_customer_points_balance` requerido y `> 0`) |
| Cambios al tope | El dueño puede subir libremente; al **bajar**, el nuevo valor debe ser `>= max(current_points)` entre cuentas del restaurante. Si no, error de validación |

### Preguntas restantes

1. **Reversión de canje que excede el tope**: cliente tiene tope = 1000, saldo = 1000, canjeó 200 hace una semana, ahora cancelan la orden donde aplicó ese canje. Al devolver los 200, el saldo sería 1200 (rompe el tope temporalmente).
   - **(a)** Cap duro: no devolver puntos (los pierde por estar en tope).
   - **(b)** Devolver completo, permitir saldo > cap temporalmente hasta que canjee de nuevo.
   - **(c)** Devolver hasta el tope y registrar diferencia perdida.
   - **Sugerencia:** (b) — la cancelación es un caso excepcional y no penalizamos al cliente.

2. **Compatibilidad con `max_points_per_order`**: ya existe este campo en el plan principal (tope de puntos ganables por una sola orden). El orden de aplicación queda: primero recortar por `max_points_per_order`, luego por `room = max_balance - current`. ¿Confirmas?

3. **¿El cap también aplica a puntos extra otorgados manualmente?** (feature futuro `POST /api/owner/loyalty/grant/`)
   - **Sugerencia:** sí, mismo tratamiento.

4. **Naming**: ¿`max_customer_points_balance` te suena bien, o prefieres algo más corto como `max_points_per_customer` o `points_cap`?

---

## 7. Archivos que se tocan

### Backend
- `apps/loyalty/models.py` (`max_customer_points_balance` obligatorio, `points_uncapped`, `cap_applied`, FK `LoyaltyRedemption.order_item`)
- `apps/loyalty/services.py` (`assign_points_for_order` con prorrateo por ítem y cap, `revert_points_for_order`, helper `_cap_notified_recently`)
- `apps/loyalty/signals.py` (notificación `loyalty.cap_reached` con anti-spam)
- `apps/loyalty/api/serializers.py` (validar obligatoriedad y baja del tope)
- `apps/loyalty/migrations/000X_soft_cap_fields.py` (campos del setting + transaction)
- `apps/loyalty/migrations/000Y_redemption_order_item_fk.py` (si no se incluyó en plan principal)
- `apps/loyalty/tests/test_soft_cap.py` *(nuevo)*

### Frontend
- `src/pages/dashboard/restaurante/lealtad.jsx` (input en tab Configuración)
- `src/pages/dashboard/cliente/puntos.jsx` (barra + banner + toast)
- `src/hooks/use-customer-loyalty-socket.js` *(nuevo o extender existente)*
- Páginas de checkout (nota informativa "esta compra no dará puntos")
- `e2e/loyalty-soft-cap.spec.js` *(nuevo)*

---

## 8. Estimación gruesa

| Componente | Tiempo |
|---|---|
| Backend (modelo, servicios, signals, tests unitarios) | 1d |
| Frontend (UI restaurante, UI cliente, toast/banner) | 1d |
| E2E Playwright | 0.5d |
| **Total** | **~2.5d** |

> Asume que [[PLAN_LEALTAD_PUNTOS]] ya está mergeado (F1–F6 completas).

---

## 9. Criterios de aceptación

- [ ] El tope máximo de puntos por cliente es obligatorio al activar el programa de recompensas.
- [ ] El dueño puede subir el tope libremente; al bajarlo, no se permite que quede por debajo del cliente con más puntos en ese restaurante.
- [ ] Cuando una compra otorgaría puntos que rebasarían el tope, se otorgan **solo los necesarios** para llenarlo.
- [ ] El cliente recibe una notificación (toast + banner) cuando llega al tope, con anti-spam de 24h.
- [ ] Si el cliente ya está en el tope, las compras siguientes no generan transacción de ganancia.
- [ ] Si un ítem de la orden tiene canje aplicado, solo ese ítem queda excluido del cálculo de puntos; el resto sí los genera proporcionalmente.
- [ ] La barra de progreso del cap se ve en la página de puntos del cliente.
- [ ] La cancelación de una orden capped revierte solo lo realmente otorgado.
- [ ] Las transacciones capped quedan marcadas en el historial (`earned_purchase_capped` + `points_uncapped` + `cap_applied`).
- [ ] Tests backend, Vitest y Playwright pasando.

---

> **Listo para revisión.** Responde las preguntas abiertas de la sección 6 antes de iniciar la implementación.
