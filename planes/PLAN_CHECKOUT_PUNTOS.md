# Plan — Canje de puntos por producto en el Checkout (UX intuitivo)

> Estado: **borrador para validación**. No iniciar implementación hasta confirmación del usuario.
>
> Fecha: 2026-05-18
>
> Autor: Claude (Opus 4.7)
>
> Relación: complementa y corrige `PLAN_LEALTAD_PUNTOS.md` (sección 4.8 — "Modificar checkout"). Este plan se enfoca **solo** en el flujo de canje en checkout y los hallazgos de la auditoría a la lógica de puntos.

---

## 1. Objetivo

1. Permitir que en el checkout el cliente **distribuya sus puntos directamente sobre los productos que aceptan canje** (`MenuItemLoyaltyConfig.allows_points_redemption=true`), sin necesidad de canjear primero una `LoyaltyReward` aparte.
2. Mostrar **feedback visual intuitivo por producto**:
   - Un **badge** con el porcentaje de descuento sobre el precio del ítem según los puntos que el usuario va seleccionando (`-12%`, `-35%`, etc.) — el color del badge varía con la magnitud del descuento.
   - El precio original tachado y el precio efectivo con descuento.
   - El equivalente en pesos del descuento (`-$3.200`).
3. Mostrar un **resumen global** del canje (puntos totales aplicados, puntos restantes en cuenta, tope global, descuento total) con barra de progreso.
4. **Corregir los bugs detectados en la lógica de puntos** que impactan el canje y la asignación (ver §3).

> Lo que **no** entra en este plan: CRUD de niveles/recompensas, configuración de lealtad para el dueño, vista cliente "/dashboard/cliente/puntos", notificaciones, expiración de puntos. Eso queda en `PLAN_LEALTAD_PUNTOS.md`.

---

## 2. Estado actual (resumen de lo que ya existe)

Backend
- Modelos completos (`RestaurantLoyaltySetting`, `LoyaltyAccount`, `LoyaltyTier`, `LoyaltyReward`, `LoyaltyTransaction`, `LoyaltyRedemption`, `MenuItemLoyaltyConfig`).
- `assign_points_for_order(order)` — asigna puntos al pasar a estado final, con `max_points_per_order`, `max_customer_points_balance` (soft cap), idempotencia y notificación `loyalty.cap_reached`.
- `revert_points_for_order(order)` — reversión al cancelar.
- `redeem_reward(user, reward, points)` — canjea una recompensa (`LoyaltyReward`): descuenta puntos del balance y crea `LoyaltyRedemption(status=pending, points_applied=0)`.
- `apply_redemption_to_order(order, redemption, line_overrides)` — al confirmar el checkout, valida `line_overrides` contra `MenuItemLoyaltyConfig`, calcula el descuento `points_to_apply * point_redeem_value` y deja el `LoyaltyRedemption(status=applied, order=order, points_applied=N)`.
- Serializer de checkout (`apps/orders/api/serializers.py:CheckoutSerializer`) acepta `loyalty_redemption_id` y `line_redemptions=[{order_item_index, points_to_apply}]`.

Frontend
- `frontend/src/pages/checkout.jsx`
  - Sección "Aplicar puntos" muestra:
    - "Canjear ahora" (dropdown con `available_rewards` del restaurante) → crea redemption + queda lista para aplicar.
    - Dropdown de canjes pendientes (`useCustomerRedemptions("pending")`).
    - Inputs numéricos por ítem para distribuir puntos del canje seleccionado entre productos habilitados.
- `frontend/src/components/restaurants/restaurant-menu.jsx` muestra pills "Gana puntos" / "Acepta canje" / "No otorga puntos" en la carta.
- El item del carrito ya transporta `allows_points_redemption`, `min_points_redeemable`, `max_points_redeemable`.

---

## 3. Hallazgos de la auditoría a la lógica de puntos

> Esta sección documenta **bugs y huecos** detectados al revisar el flujo extremo-a-extremo. Los importantes para checkout están marcados con ⚠️ y se corrigen como parte de este plan; los demás quedan registrados para considerar en otro plan.

### ⚠️ B1 — Productos canjeados igual generan puntos al final del pedido

En `apps/loyalty/services.py:_eligible_total_amount` se excluyen del cálculo de puntos los `OrderItem` cuyos IDs aparecen en `LoyaltyRedemption(order=…, order_item__isnull=False, status='applied')`. Sin embargo, `apply_redemption_to_order` **nunca asigna `order_item`** en el `LoyaltyRedemption` — solo asigna `order`, `status` y `points_applied`. Resultado: la exclusión nunca dispara. Un producto donde el cliente canjeó parte con puntos **sigue generando puntos** sobre su precio completo al cerrar el pedido. Es exactamente lo contrario de la regla deseada ("no se gana puntos sobre lo que ya pagaste con puntos").

**Fix**: en `apply_redemption_to_order`, cuando vengan `line_overrides` con `points_to_apply > 0`, crear (o usar) un `LoyaltyRedemption` por línea con `order_item=order_items[index]` y `points_applied=points_for_item`. Ver §5.2.

### ⚠️ B2 — Puntos perdidos cuando el usuario canjea una `LoyaltyReward` y aplica menos en checkout

`redeem_reward` descuenta el costo completo de la recompensa del balance del usuario **antes** del checkout (`points_delta = -reward.points_cost`). Luego en `apply_redemption_to_order`, si `line_overrides` suman menos puntos que `requested_points`, el descuento al pedido es solo por lo aplicado, **pero los puntos no aplicados ya están perdidos** (se quedan en la transacción negativa). No se devuelven ni quedan disponibles.

**Fix**: este plan se enfoca en el **canje directo por ítem** (sin pasar por una `LoyaltyReward`), donde los puntos se descuentan en el momento del checkout exactamente por lo aplicado. El flujo viejo basado en `LoyaltyReward` queda **opcional y aislado** (no se rompe), pero la UI principal del checkout no lo usa. Ver §4.2.

### ⚠️ B3 — Descuento puede exceder el precio del ítem

Hoy `apply_redemption_to_order` solo limita por `max_redeemable_points_per_order` y por los puntos comprometidos en el `LoyaltyRedemption`. Si un ítem cuesta $3.000 y el usuario aplica 5.000 puntos (con `point_redeem_value=1`), el descuento sería $5.000 — más que el ítem. El `total_amount = max(subtotal + fees - discount, 0)` lo termina llevando a cero, pero el cliente está "regalando" puntos sin entender el motivo.

**Fix**: por línea, cap `points_to_apply * point_redeem_value <= order_item.line_total_amount`. Validar también en frontend para no permitir inputs imposibles. Ver §5.2.

### ⚠️ B4 — `points_earned` y `currency_unit_amount` mal explicados al ganar

`assign_points_for_order` calcula `units_spent = floor(total / currency_unit_amount)` y `points = units_spent * points_earned`. Si `currency_unit_amount = 1000` y `points_earned = 2`, una compra de 1.999 paga 1 unidad → 2 puntos; una compra de 2.000 paga 2 unidades → 4 puntos. Está bien matemáticamente, pero el copy actual del checkout y de la carta no aclara este redondeo. **No es bloqueante para este plan**, pero la UI de "Aplicar puntos" debe usar el mismo `point_redeem_value` que el backend (y mostrarlo).

Usuario: Se debe validar este B4, que tanto backend como frontend validen y muestren igual, y si, 1.999 seria una unidad y 2.000 2 unidades

### B5 — `point_redeem_value` no fijado bloquea silenciosamente todo canje

Si el dueño activa el programa pero no configura `point_redeem_value` (es `null`), `apply_redemption_to_order` levanta `ValueError("El restaurante no configuro la equivalencia de canje por punto.")`. El error llega al cliente al confirmar el pedido — demasiado tarde. La UI debería **deshabilitar la sección "Aplicar puntos"** y mostrar mensaje claro si no hay `point_redeem_value` configurado para el restaurante.

**Fix UI**: en checkout consultar `useCustomerLoyalty(restaurant.id)`; si `point_redeem_value` es falsy → ocultar / deshabilitar el bloque con tooltip "Este restaurante aún no configuró la equivalencia para canje".

### B6 — `LoyaltyRedemption.order_item` es FK simple

Si en el futuro permitimos canjes parciales sobre un mismo `OrderItem` desde múltiples `LoyaltyReward`, el modelo se queda corto. Por ahora con `OneToOne` lógico (un `LoyaltyRedemption` por `OrderItem`) y `loyalty_reward` requerido alcanza. No se cambia en este plan; se confirma decisión en §7-Q1.

### B7 — `LoyaltyReward` requerido cuando el canje es directo (sin recompensa)

Para el nuevo flujo "canje directo por producto", no hay una `LoyaltyReward` asociada. El modelo actual exige `loyalty_reward` (FK `PROTECT`, no nullable).

**Fix**: hacer `LoyaltyRedemption.loyalty_reward` opcional (`null=True, blank=True`) → la redemption puede representar tanto "canje de una recompensa" como "canje directo de puntos sobre un ítem del pedido".

### B8 — Soft cap notifica solo al ganar, no se ve en checkout

Cuando el usuario está en `max_customer_points_balance`, una notificación se envía pero el checkout no recuerda el tope. **Fix UI**: el panel "Aplicar puntos" muestra `currentPoints / max_customer_points_balance` con un hint "Estás en el tope — usa tus puntos para liberar saldo".

---

## 4. UX propuesto en el checkout

### 4.1 Resumen visual

Cuando el carrito incluya al menos un producto con `allows_points_redemption=true` **y** el restaurante tenga `is_active=true` y `point_redeem_value > 0` **y** el cliente esté autenticado y tenga `current_points > 0`:

```
┌─ Aplicar tus puntos ─────────────────────────────────────────┐
│  Tienes 4.520 puntos.   1 punto = $5      Máx: 2.000 pts/pedido│
│  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░  900 / 2.000 aplicados   ($4.500)        │
│                                                              │
│  ┌─ Hamburguesa Clásica ──────────────  $18.000  →  $12.000 ┐ │
│  │                                                          │ │
│  │   [───────●────────────────]  300 / 800 pts              │ │
│  │   Mín 50 pts · Máx 800 pts          [-$1.500 · -8% ⬇️]    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Papas Rústicas (no admite canje con puntos) ───────────┐ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Limonada de Coco ──────────────────  $9.000  →  $4.500 ┐ │
│  │   [────────────●───────────]  900 / 1.500 pts            │ │
│  │   Mín 100 pts · Máx 1.500 pts        [-$4.500 · -50% 🔥] │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Diferencias contra la UI actual

| Hoy | Propuesto |
|---|---|
| Selecciona una `LoyaltyReward` y luego distribuye | **Directo**: distribuir puntos por ítem; no se requiere una `LoyaltyReward` |
| Input `<input type=number>` | **Slider** + input numérico sincronizado (mejor en mobile y desktop) |
| Sin feedback de descuento | **Badge** "-12% ⬇️" / "-35% 🔥" + tachado del precio original + nuevo precio |
| Sin barra global | Barra de progreso global de puntos aplicados / tope del pedido |
| Sin pista del balance | Encabezado con "Tienes N puntos" y la equivalencia `1 punto = $X` |
| Sección "Canjear ahora" (de recompensas) y "Canje pendiente" mezcladas | Se mantiene "Canjear ahora" pero **separada** (solo si el restaurante tiene `LoyaltyReward` activas y el cliente tiene canjes pendientes). El bloque principal pasa a ser **canje directo** |

### 4.3 Reglas para el badge de %

`percent = round((points_to_apply * point_redeem_value / line_total_amount) * 100)`

| Rango | Tono | Emoji opcional |
|---|---|---|
| `0%` | sin badge | — |
| `1–14%` | gris claro | — |
| `15–34%` | esmeralda / verde | `⬇️` |
| `35–69%` | naranja / lima | `🔥` |
| `70–99%` | rojo intenso / dorado | `💎` |
| `100%` (gratis) | badge especial "GRATIS" | `🎁` |

Tooltip al hover: `"Aplicando 900 puntos → -$4.500 (50% del producto)"`.

### 4.4 Restricciones validadas en cliente

Por cada ítem en `lineRedemptionPoints[i]`:

1. `value ≥ 0`.
2. `value === 0 || value ≥ item.min_points_redeemable`.
3. `value ≤ item.max_points_redeemable` (si está definido).
4. `value * point_redeem_value ≤ line_total` ← **nuevo cap** (B3).
5. `Σ values ≤ Math.min(setting.max_redeemable_points_per_order, currentPoints)`.

El slider/input limita el máximo automáticamente. Si el usuario teclea un valor fuera del rango, se hace clamp + se muestra un hint inline.

### 4.5 Estado vacío / inactivo

- Sin productos elegibles en el carrito ⇒ no se renderiza el bloque.
- Programa inactivo (`is_active=false`) ⇒ no se renderiza.
- `point_redeem_value` nulo ⇒ se renderiza un banner "Este restaurante aún no configuró el valor de cada punto en pesos. Pídeselos para usar tus puntos en tus pedidos." (no input).
- `currentPoints === 0` ⇒ banner "Aún no tienes puntos en este restaurante. Sigue pidiendo para acumular."
- Cliente en cap ⇒ banner azul "¡Estás en el tope de puntos! Aplícalos aquí para seguir acumulando."

### 4.6 Resumen del lado derecho (sticky)

Se agrega una línea entre **Subtotal** y **Total**:

```
Subtotal             $50.000
Domicilio            $3.000
Descuento puntos   – $6.000   (1.200 pts)
─────────────────────────────
Total                $47.000
```

---

## 5. Cambios técnicos

### 5.1 Modelos / migraciones

**Archivo**: `backend/apps/loyalty/models.py`

- `LoyaltyRedemption.loyalty_reward` → `null=True, blank=True`. Quitar la obligatoriedad para permitir canjes "directos" sin pasar por una `LoyaltyReward` (B7).
- Agregar campo `LoyaltyRedemption.is_direct = BooleanField(default=False)` para distinguir explícitamente "canje directo desde checkout" de "canje pre-creado desde recompensa".
- (Opcional) `LoyaltyTransactionType` semilla `direct_redemption` para tipar las transacciones nuevas en `signals.py`/`post_migrate`.

**Migración**: `loyalty/000X_redemption_optional_reward.py`.

### 5.2 Servicio: nuevo flujo "canje directo en checkout"

**Archivo**: `backend/apps/loyalty/services.py`

Nueva función:

```python
@transaction.atomic
def apply_direct_line_redemptions(order: Order, line_redemptions: list[dict]) -> Decimal:
    """
    Aplica un canje directo (sin LoyaltyReward) por línea sobre la orden.
    line_redemptions = [{"order_item_index": int, "points_to_apply": int}, ...]
    Devuelve el descuento total en pesos.
    """
```

Comportamiento:
1. Valida `order.user` y restaurante con setting activo y `point_redeem_value > 0`.
2. Calcula `currentPoints` de `LoyaltyAccount`. Si no hay cuenta o `currentPoints == 0` → devuelve `Decimal("0.00")`.
3. Para cada línea con `points_to_apply > 0`:
   - Recupera `order_item = order.items.all()[index]`.
   - Valida `MenuItemLoyaltyConfig`:
     - `allows_points_redemption=true`.
     - `points >= min_points_redeemable`.
     - `max_points_redeemable is None or points <= max_points_redeemable`.
   - **Nuevo (B3)**: `points * point_redeem_value <= order_item.line_total_amount` (clamp a ese valor si excede, levantar error si la diferencia es grande — política decidida en §7-Q3).
   - Acumula.
4. Suma total `points_total`:
   - `points_total ≤ currentPoints` (sino → `ValidationError "No tienes puntos suficientes."`).
   - `points_total ≤ max_redeemable_points_per_order` (si está definido).
5. Crea **una sola `LoyaltyTransaction`** con `tx_type=direct_redemption`, `points_delta=-points_total`.
6. Por cada línea con puntos > 0, crea un `LoyaltyRedemption` con:
   - `loyalty_transaction=<la transacción común>`.
   - `loyalty_reward=None`.
   - `order=order`.
   - `order_item=order_item`. ← **fix B1**: ahora `_eligible_total_amount` excluye correctamente.
   - `status=applied`, `points_applied=points_for_item`, `is_direct=True`.
7. Descuenta `current_points` del `LoyaltyAccount` y guarda.
8. Devuelve `Σ (points_for_item * point_redeem_value)` redondeado a 2 decimales.

Nota: una sola transacción agregada para no inflar el historial; los detalles quedan en los `LoyaltyRedemption` por línea.

### 5.3 Checkout serializer

**Archivo**: `backend/apps/orders/api/serializers.py`

1. Aceptar `line_redemptions` **sin** `loyalty_redemption_id` (modo "canje directo").
2. Si `loyalty_redemption_id` está presente → flujo viejo (`apply_redemption_to_order`) — se mantiene.
3. Si `loyalty_redemption_id` está ausente y `line_redemptions` tiene puntos → flujo nuevo (`apply_direct_line_redemptions`).
4. Validaciones tempranas (antes de crear la orden):
   - Usuario autenticado.
   - Restaurante con `is_active` y `point_redeem_value > 0`.
   - Los índices de `line_redemptions` coinciden con `items`.
5. Después de crear `OrderItem`s, llamar al servicio con la lista validada.

### 5.4 Validación de "no ganar puntos sobre lo canjeado" (B1)

`apps/loyalty/services._eligible_total_amount` ya tiene la lógica de exclusión, pero requería que `order_item` estuviera asignado en el `LoyaltyRedemption`. Con §5.2 ahora se asigna correctamente. **No cambia el código de `_eligible_total_amount`** (solo se beneficia del fix de §5.2).

### 5.5 Frontend — checkout

**Archivo**: `frontend/src/pages/checkout.jsx`

Reorganizar el bloque "Aplicar puntos":

1. Sub-sección **"Usa tus puntos en este pedido"** (nuevo, default).
   - Solo aparece si `loyaltyData.is_active`, `Number(loyaltyData.point_redeem_value) > 0`, `loyaltyData.current_points > 0`, y el carrito tiene al menos un `item.allows_points_redemption`.
   - Encabezado: balance + equivalencia + cap.
   - Barra de progreso global.
   - Tarjetas por ítem elegible (con slider + input + badge `%`).
   - Items NO elegibles aparecen colapsados con un texto sutil ("No admite canje con puntos").
2. Sub-sección **"Canjes pendientes / Recompensas"** (preserva el flujo viejo, opcional).
   - Solo aparece si `restaurantRedemptions.length > 0 || quickRewards.length > 0`.

**Componentes nuevos**:

- `frontend/src/components/checkout/loyalty-direct-redemption.jsx`
  - Props: `items, loyaltyData, lineRedemptionPoints, setLineRedemptionPoints, totalPointsApplied, totalDiscount, globalCap`.
  - Subcomponente `LoyaltyItemSlider` por línea (slider + input + badge).
- `frontend/src/components/checkout/loyalty-discount-badge.jsx`
  - Pure component que recibe `points, pointValue, lineTotal` y produce un Badge con tono + emoji + label `"-X% • -$Y"` y tooltip.

**Cambios en el `submitOrder` payload**:
- Si el flujo directo está activo: enviar `loyalty_redemption_id: null` y `line_redemptions: [...]` solo para ítems con `points_to_apply > 0`.
- Si el usuario seleccionó un canje pendiente: comportamiento actual (sin cambios).

### 5.6 Hooks / servicios

- `frontend/src/hooks/use-orders.js:useCustomerLoyalty` ya devuelve `is_active`, `point_redeem_value`, `current_points`, `max_redeemable_points_per_order`, `max_customer_points_balance`. ✅ no requiere cambios.
- `frontend/src/services/loyalty.js` — sin cambios para este plan (no se agrega endpoint de "directo" porque el canje directo se hace inline en checkout).

### 5.7 Indicador en la carta (`restaurant-menu.jsx`)

Pequeño ajuste para que el pill "Acepta canje" del menú muestre directamente la equivalencia cuando el cliente está autenticado:

> _"Acepta canje · puedes pagar hasta $4.000 con puntos en este plato."_

(Computado desde `min_points_redeemable`, `max_points_redeemable`, y `point_redeem_value`.)

---

## 6. Plan de pruebas

### Backend (`dm pytest`)
- `apps/loyalty/tests/test_direct_redemption.py`
  - Cliente sin cuenta de lealtad → `apply_direct_line_redemptions` devuelve 0.
  - Cliente con saldo < requerido → error.
  - Producto sin `allows_points_redemption` → error en validación.
  - Producto bajo el `min_points_redeemable` → error.
  - Producto sobre el `max_points_redeemable` → error.
  - **`points * point_redeem_value > line_total`** → error o clamp (según decisión §7-Q3).
  - `Σ puntos > max_redeemable_points_per_order` → error.
  - Caso feliz → crea N `LoyaltyRedemption` con `order_item` correctos, descuenta `current_points`, devuelve discount correcto.
- `apps/loyalty/tests/test_eligible_total_after_direct_redemption.py`
  - Tras un canje directo en 2 de 3 items, al pasar a "delivered" solo el 3.º suma puntos (regresión a B1).
- `apps/orders/tests/test_checkout_loyalty.py`
  - Checkout con `line_redemptions` sin `loyalty_redemption_id` aplica descuento.
  - Checkout con `loyalty_redemption_id` (flujo viejo) sigue funcionando.
  - Discount no excede `subtotal + fees`.

### Frontend
- Vitest `loyalty-direct-redemption.test.jsx`
  - Renderiza sliders solo para items elegibles.
  - Cambiar slider muestra el badge con `%` y monto.
  - Cap global respetado.
  - Items no elegibles aparecen con copy "No admite canje".
- Playwright `e2e/checkout-points.spec.js`
  - Setup: dueño activa lealtad, fija `point_redeem_value`, marca un item como canjeable.
  - Cliente con saldo aplica puntos → ve descuento en resumen → confirma pedido → ve total con descuento → backend no asigna puntos sobre el item canjeado al cerrar.

---

## 7. Preguntas abiertas

1. **Indexación del `LoyaltyRedemption` por línea**: ¿está bien crear 1 `LoyaltyRedemption` por `OrderItem` que tenga puntos aplicados, todas apuntando a la misma `LoyaltyTransaction`? O ¿preferes 1 sola redemption con `points_applied` agregado y dejar de poblar `order_item`? La primera opción es la que arregla B1 sin tocar `_eligible_total_amount`. Recomendación: **opción 1**.
2. **¿Conservar el flujo de canjear `LoyaltyReward` desde checkout?** Hoy el cliente puede "canjear y aplicar" una `LoyaltyReward` en la misma vista. La auditoría detectó que puede perder puntos si aplica menos de lo canjeado (B2). Recomendación: **conservar el flujo pero solo cuando haya recompensas configuradas**; el flujo principal es directo por producto.
3. **Cuando `points * point_redeem_value > line_total` (B3)**: ¿clampear automáticamente el input o mostrar error y forzar al usuario a bajarlo? Recomendación: **clampear** silenciosamente en el slider (no permitir excederlo) y validar en backend con error para protegerse contra requests manipulados.
4. **¿Mostrar la sección "Aplicar puntos" si el cliente no está autenticado?** Recomendación: no — invitar a iniciar sesión con un CTA discreto solo si el carrito tiene productos canjeables.
5. **¿Permitir 100% gratis con puntos?** (descuento == precio del ítem). Recomendación: sí, con badge "GRATIS 🎁". Si el cliente cubre toda la orden con puntos, el `total_amount` queda en 0 y se respeta el flujo de orden gratuita (revisar `payment_status`).

---

## 8. Fases sugeridas

| Fase | Alcance | Riesgo | Estimación |
|---|---|---|---|
| **F1** | Migración: `LoyaltyRedemption.loyalty_reward` nullable + `is_direct` + tipo de transacción `direct_redemption`. | Bajo | 0.5d |
| **F2** | `apply_direct_line_redemptions` + cap por ítem (B3) + integración en `CheckoutSerializer`. Tests backend. | Medio | 1.5d |
| **F3** | UI checkout — componentes `LoyaltyDirectRedemption` + `LoyaltyDiscountBadge` + sliders + barra global. | Medio | 1.5d |
| **F4** | Indicador en la carta (precio equivalente con puntos) + estados vacíos (`point_redeem_value` nulo, cap, sin puntos). | Bajo | 0.5d |
| **F5** | Vitest + Playwright. | Bajo | 1d |
| **Total** | | | **~5d** |

---

## 9. Criterios de aceptación

- [ ] En checkout, los productos con `allows_points_redemption=true` muestran un slider + input numérico + badge con el `%` de descuento al mover el slider.
- [ ] El badge cambia de color según la magnitud (gris < verde < naranja < dorado).
- [ ] El precio original del ítem se tacha y se muestra el precio efectivo con descuento.
- [ ] El resumen de la derecha muestra una línea "Descuento puntos – $X (N pts)".
- [ ] No se permite asignar más puntos que `min(max_redeemable_points_per_order, current_points)`.
- [ ] No se permite que el descuento por ítem exceda su `line_total_amount` (cap automático en cliente, validación dura en servidor).
- [ ] Al confirmar el pedido, los puntos se descuentan del balance una sola vez (no se "pre-canjean").
- [ ] Los productos sobre los que se aplicaron puntos **no generan puntos** al cerrar el pedido (regresión B1).
- [ ] Si el cliente está al tope (`max_customer_points_balance`), el banner correspondiente se muestra y el flujo de canje sigue habilitado.
- [ ] El flujo viejo de "Canjear ahora" (`LoyaltyReward`) sigue funcionando si hay recompensas configuradas para el restaurante.
- [ ] Tests backend (`dm pytest apps/loyalty/ apps/orders/`) y E2E pasando.

---

> **Listo para revisión.** Confirma sección 7 (preguntas abiertas) y cualquier ajuste antes de proceder a la implementación por fases.
