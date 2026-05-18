# Plan — Ajustes UX y flujo de canje del módulo Lealtad

> Plan derivado de los 5 puntos de feedback sobre la vista `/dashboard/restaurante/lealtad` y la falta de flujo de canje para el cliente.
> Pre-requisito: leer `PLAN_LEALTAD_PUNTOS.md` (modelo de datos y reglas base ya implementados).

---

## 0. Resumen ejecutivo

Cinco frentes de trabajo independientes pero relacionados:

| # | Tema | Capa principal | Riesgo |
|---|------|----------------|--------|
| 1 | Separar "da puntos" de "acepta canje" en el producto + mostrarlo al cliente | Backend + Frontend | Medio (cambia semántica de un campo existente, requiere migración y backfill) |
| 2 | Iconos de info con ejemplos en Configuración | Frontend | Bajo |
| 3 | Niveles: edición con botón Guardar (fin del bug de "se come letras") | Frontend | Bajo |
| 4 | Recompensas: rediseño de creación con labels y descripciones | Frontend | Bajo |
| 5 | Flujo de canje cliente-final (faltante) | Backend (menor) + Frontend | Alto (es un flujo nuevo end-to-end) |

**Causa del bug de "se come letras" en niveles (punto 3):** cada `onChange` de los inputs (`lealtad.jsx:116-119`) llama `updateTier(...)` → `await load()`, que reemplaza el array `tiers` con la respuesta del backend. El input pierde el foco/sincronía a mitad de tipeo. La cura es **estado local + botón Guardar por fila** (no debounce).

---

## 1. Punto 1 — Switch "Da puntos" en el producto

### 1.1 Diagnóstico

Hoy el modelo `MenuItemLoyaltyConfig` (`backend/apps/menu/models.py:71`) solo tiene `allows_points_redemption`. Ese campo se usa en `services.py` para **dos cosas distintas**:

- `_eligible_total_amount` (línea 32-54): si `allows_points_redemption=True` (o no hay config), el monto del producto cuenta para **ganar** puntos.
- `apply_redemption_to_order` (línea 306-316): si `allows_points_redemption=False`, no se puede **canjear** puntos contra ese producto.

Esto está conflado y va contra lo que pide el feedback. Solución: introducir un campo nuevo `earns_points` separado de `allows_points_redemption`.

### 1.2 Cambios de modelo

`backend/apps/menu/models.py:71-83`:

```python
class MenuItemLoyaltyConfig(BaseModel):
    menu_item = models.OneToOneField(...)
    earns_points = models.BooleanField(default=False)          # NUEVO
    allows_points_redemption = models.BooleanField(default=False)
    min_points_redeemable = models.PositiveIntegerField(default=0)
    max_points_redeemable = models.PositiveIntegerField(null=True, blank=True)
```

**Default y backfill (DECISIÓN):** el usuario pidió "por defecto, no". Para los productos existentes hay dos caminos:

- (A) Migración de datos que setea `earns_points = allows_points_redemption` para preservar el comportamiento actual.
- (B) Migración que pone todo en `False` y exige que el dueño configure manualmente.

Recomiendo **(A)**: respeta lo que ya estaba funcionando (productos sin config sumaban puntos por defecto en `_eligible_total_amount`). Para esos productos sin `MenuItemLoyaltyConfig`, creamos una fila con `earns_points=True, allows_points_redemption=False` en una migración de datos. Para los que ya tenían config con `allows_points_redemption=True`, copiamos a `earns_points=True`. Así nadie pierde puntos de la noche a la mañana.

### 1.3 Cambios en `services.py`

Reemplazar el chequeo en `_eligible_total_amount`:

```python
# Antes:
if config is None or config.allows_points_redemption:
    eligible_total += order_item.line_total_amount

# Después:
if config is not None and config.earns_points:
    eligible_total += order_item.line_total_amount
```

Y mantener `allows_points_redemption` en `apply_redemption_to_order` (sin cambios).

### 1.4 Serializers + endpoint

`backend/apps/menu/api/serializers.py:99-128`:
- Añadir `earns_points` como `BooleanField(required=False, default=False)` en `OwnerMenuItemWriteSerializer`.
- Exponer `earns_points` en `OwnerMenuItemReadSerializer` y en el `MenuItemReadSerializer` que consume la **vista del cliente** (esto último es crítico para que el badge sea visible).
- Lógica de `create()` y `update()`: persistir `earns_points` igual que los demás campos del loyalty config.

### 1.5 Cambios de UI (dueño)

`frontend/src/pages/dashboard/restaurante/menu.jsx:533-573`, sección "Canje con puntos":

Cambiar a dos sub-bloques claros:

```
┌─────────────────────────────────────────────┐
│ Puntos                                       │
│                                              │
│ ☐ Este producto otorga puntos al comprarlo  │ (ⓘ)
│   Si está apagado, los clientes NO ganan    │
│   puntos por el precio de este producto.    │
│                                              │
│ ☐ Este producto se puede pagar con puntos   │ (ⓘ)
│   Permite que el cliente aplique parte de   │
│   sus puntos como descuento aquí.           │
│   ┌─Min puntos─┐  ┌─Max puntos─┐            │
└─────────────────────────────────────────────┘
```

- Campo `earns_points` en el schema Zod (`menu.jsx:62`): `z.boolean().default(false)`.
- Cuando `allows_points_redemption=false`, deshabilitar visualmente los inputs min/max.

### 1.6 Cambios de UI (cliente)

Dos lugares donde mostrar el indicador:

**a) `frontend/src/components/restaurants/restaurant-menu.jsx:143-170`** — junto al precio de cada producto:

- Si `item.earns_points` → badge pequeño "Gana puntos" + ícono `Info`.
- Si `item.allows_points_redemption` → badge "Acepta canje" + ícono `Info` (ya existe `FriendlyLoyaltyBadge`, extender para distinguir los dos casos).
- Al hacer click/hover en el ícono → `Popover` (componente ya disponible en `ui/popover.jsx`) con texto orientado al cliente:
  - "Gana puntos: cada peso que gastes en este plato suma para tu programa de fidelidad."
  - "Acepta canje: puedes pagar parte de este plato con tus puntos (mínimo X, máximo Y)."

**b) Para productos que NO dan puntos** (lo que el usuario pidió explícitamente: "que el cliente vea qué productos dan puntos o no"):

- Si el restaurante tiene programa activo y el producto **no** gana puntos → mostrar un texto sutil "No otorga puntos" con ícono `Info` que abra popover explicando por qué (decisión del restaurante).

### 1.7 Tests

- `backend/apps/loyalty/tests/test_services.py`: añadir caso donde un producto con `earns_points=False` no suma al `eligible_total`.
- Test de regresión: producto sin `MenuItemLoyaltyConfig` después de la migración tiene `earns_points=True` (preservar comportamiento histórico).
- Test E2E (Playwright) opcional: el badge "Gana puntos" aparece en el menú público.

---

## 2. Punto 2 — Iconos de info en Configuración

### 2.1 Diagnóstico

`frontend/src/pages/dashboard/restaurante/lealtad.jsx:59-105` muestra 6 campos sin contexto. Un dueño que no sea técnico no entiende qué hace `currency_unit_amount` vs `point_redeem_value`.

### 2.2 Diseño

Para cada campo añadir un ícono `Info` (de `lucide-react`) que abra un `Popover` con:

- **Para qué sirve** (1 línea, lenguaje cotidiano).
- **Ejemplo concreto** con números reales en COP.
- **Qué pasa si lo dejas vacío** (cuando aplique).

Textos propuestos (revisables):

| Campo | Texto del popover |
|-------|-------------------|
| Pesos por unidad | "Es el monto en pesos que equivale a una 'unidad' de gasto. Ejemplo: si pones 1.000, cada $1.000 que gasta tu cliente genera un 'punto base' que luego se multiplica por 'Puntos ganados'." |
| Puntos ganados | "Cuántos puntos da cada unidad gastada. Ejemplo: si pones 2 y la unidad son $1.000, un pedido de $25.000 da 50 puntos." |
| Tope puntos por orden | "Máximo de puntos que un cliente puede **ganar** en un solo pedido. Útil para limitar promociones grandes. Déjalo vacío si no quieres tope." |
| Tope canje por orden | "Máximo de puntos que un cliente puede **gastar** (canjear) en un solo pedido. Déjalo vacío si no quieres tope." |
| VIP por pedidos completados | "Cantidad de pedidos completados para considerar a un cliente VIP. (Pendiente: este indicador todavía es informativo, no afecta los puntos.)" |
| Valor de canje por punto | "Cuántos pesos vale cada punto al canjearlo. Ejemplo: si pones 10, el cliente que canjea 100 puntos recibe $1.000 de descuento. Sin este valor, no se pueden aplicar canjes." |

Además, añadir un **resumen en vivo** debajo de los campos (ya existe la frase "Por cada $X ganan Y punto(s)") — extenderlo a 2 líneas:

```
Acumulación: Por cada $1.000 tus clientes ganan 2 punto(s).
Canje:       Cada 100 puntos valen $1.000 de descuento.
```

### 2.3 Helper reutilizable

Crear `frontend/src/components/ui/info-hint.jsx`:

```jsx
export function InfoHint({ children }) {
  return (
    <Popover>
      <PopoverTrigger><Info className="h-4 w-4 text-muted-foreground" /></PopoverTrigger>
      <PopoverContent className="max-w-xs text-sm">{children}</PopoverContent>
    </Popover>
  )
}
```

Lo usaremos en los 5 puntos (configuración, niveles, recompensas, menú, etc.).

---

## 3. Punto 3 — Niveles editables sin pérdida de tecleo

### 3.1 Diagnóstico del bug

`lealtad.jsx:114-122`:

```jsx
<Input value={tier.name} onChange={(event) => updateTier(tier.id, { name: event.target.value })} />
```

`updateTier` (`use-loyalty.js:94-97`) hace `await updateOwnerLoyaltyTier(...)` y luego `await load()`. Cada letra dispara una petición HTTP y reemplaza el array `tiers`. React re-renderiza el input con el valor "freshly loaded", que puede llegar **antes o después** del próximo keystroke → letras perdidas.

### 3.2 Solución

Reescribir la pestaña Niveles con:

- **Estado local de borrador por fila** (`tiers` del backend solo se usa como valor inicial).
- **Botón Guardar y Cancelar por fila** (o por nivel en edición).
- **Validación visible** antes de guardar: `min_points` único, sin solapes, `max_points > min_points`.
- **Header de columna explícito**: Nombre · Mínimo de puntos · (Beneficio futuro) · Acciones.
- **Ocultar el campo `code`** del UI: se genera automáticamente desde el nombre (slugify) si está vacío, o se mantiene si ya existe.
- **Ocultar `max_points`**: no se usa en la lógica (`services.py:57-87` solo lee `min_points`). Dejarlo fuera del formulario reduce confusión. Si más adelante se implementa, se reintegra.
- **Mensaje vacío explicativo**: cuando no hay niveles, mostrar un texto del tipo: "Aún no tienes niveles. Por defecto todos tus clientes son nivel 'Base'. Crea niveles para segmentar (ej: Bronce desde 0, Plata desde 500, Oro desde 2000)."

### 3.3 Layout propuesto (modo edición inline)

```
┌──────────────────────────────────────────────────────────┐
│ Niveles de fidelidad                                      │
│ Segmenta a tus clientes según los puntos acumulados.      │
│ Hoy el nivel sólo se muestra al cliente, no otorga        │
│ beneficios automáticos (próximamente).                    │
│                                                            │
│ Nombre         Desde N puntos     [✏️ Editar] [🗑]        │
│ Bronce         0                   ...                     │
│ Plata          500                                         │
│ Oro            2.000                                       │
│                                                            │
│ [+ Agregar nivel]                                          │
└──────────────────────────────────────────────────────────┘

(Modo edición de una fila:)
Nombre [___________] Desde [_____] puntos  [Guardar] [Cancelar]
```

### 3.4 Cambios técnicos

- Refactor de la pestaña `tiers` en `lealtad.jsx`: extraer a un componente `TiersTab` propio.
- Estado: `useState({ editingId: null, draft: {...} })`.
- `create` y `update` se llaman **solo en Guardar**.
- Mostrar errores de validación del backend en línea (no como toast efímero).

### 3.5 Tests

- Componente: que el input mantenga el foco y el valor mientras se tipea (test Vitest con `userEvent`).
- API: validación de solape de tiers — añadir test si no existe en `backend/apps/loyalty/tests/test_tiers.py`.

---

## 4. Punto 4 — Recompensas con creación clara

### 4.1 Diagnóstico

`lealtad.jsx:130-155` tiene el mismo patrón inline de 7 columnas sin labels, con el mismo bug de "se come letras" porque también llama `updateReward(...)` en cada `onChange`.

### 4.2 Solución

Aplicar el mismo patrón que niveles, pero con un **modal/dialog** para crear y editar (porque las recompensas tienen más campos y un campo `description` que ahora ni se muestra).

#### Lista de recompensas (vista compacta)

Tarjetas (no tabla) con:

- Nombre de la recompensa (grande).
- Descripción (texto secundario, 2 líneas con ellipsis).
- "Cuesta X puntos" — chip destacado.
- Estado: Activa / Pausada / Sin cupos / Vencida (derivado de `is_active`, `available_quantity`, `valid_until`).
- Botones: Editar, Eliminar.

#### Modal "Nueva recompensa" / "Editar recompensa"

Con `<Dialog>` ya disponible en `ui/dialog.jsx`. Cada campo con `InfoHint`:

| Campo | Helper |
|-------|--------|
| Nombre | (Sin ayuda — obvio) |
| Descripción | "Texto que verá tu cliente al ver la recompensa. Ej: 'Postre del día gratis'." |
| Costo en puntos | "Cuántos puntos cuesta canjear. El cliente debe tener al menos esa cantidad." |
| Cupos disponibles | "Stock global. Cada canje resta uno. Déjalo vacío si no hay límite." |
| Máximo por usuario | "Cuántas veces el mismo cliente puede canjear esta recompensa. Vacío = sin límite." |
| Vigente hasta | "Fecha desde la cual la recompensa deja de poder canjearse. Vacío = sin vencimiento." |
| Activa | Switch — "Si está apagada, no aparece a los clientes." |

#### Texto introductorio de la pestaña

Encabezado: "Las recompensas son lo que tus clientes pueden canjear con sus puntos. Pueden ser productos, descuentos o beneficios. Para que un canje aplique como descuento en un pedido, recuerda configurar 'Valor de canje por punto' en la pestaña Configuración."

### 4.3 Tests

- Vitest: que abrir el modal, editar y guardar persiste el cambio sin recargar la lista mientras se tipea.

---

## 5. Punto 5 — Flujo de canje del cliente (faltante)

### 5.1 Diagnóstico

Hoy:

- Existe el endpoint `POST /api/loyalty/customer/redeem/` (`backend/apps/loyalty/api/views.py:145-162`) que recibe `{reward_id, points?}` y crea un `LoyaltyRedemption` en estado **pending**.
- Existe la vista del cliente `frontend/src/pages/dashboard/cliente/puntos.jsx` (no la abrí completa, pero está listada).
- Existe `frontend/src/pages/checkout.jsx` que en líneas 242-310 permite **aplicar** un canje pendiente a una orden, distribuyendo puntos entre productos elegibles.
- Existe `FriendlyLoyaltyBadge` en `restaurant-menu.jsx:194` que solo muestra info, no permite acción.

**Falta:** UI para **crear** el canje (llamar al endpoint `redeem`). No hay un botón "Canjear X puntos por esta recompensa" en ningún flujo del cliente.

Además, el flujo actual exige que el cliente:
1. Vaya a otra vista a canjear una recompensa → 2. luego añada productos al carrito → 3. luego en checkout distribuya los puntos. Es desconcertante.

### 5.2 Diseño propuesto — dos puntos de canje

**(A) Dashboard del cliente — `dashboard/cliente/puntos.jsx`**

Sección "Recompensas disponibles":

- Lista de las recompensas activas del/los restaurante(s) donde el cliente tiene puntos (filtrado backend: ya hay endpoint).
- Cada tarjeta:
  - Nombre + descripción + costo en puntos.
  - Disponibilidad ("X cupos disponibles", "Vence el dd/mm").
  - Botón **"Canjear"** → confirm dialog → llama `redeem(reward_id)` → toast "Canje creado, aplícalo en tu próximo pedido".
  - Si no tiene puntos suficientes, botón deshabilitado con tooltip "Te faltan N puntos".

Sección "Mis canjes pendientes":

- Tabla con redemptions en estado `pending` (ya existe `useCustomerRedemptions("pending")`).
- Botón "Aplicar en mi próximo pedido" → te lleva al restaurante en cuestión.
- Botón "Cancelar canje" → endpoint nuevo `DELETE /api/loyalty/customer/redemptions/<id>/` que revierte los puntos al `current_points` del cliente. **(Endpoint nuevo a implementar.)**

**(B) Checkout — atajo inline**

El checkout actual asume que el cliente ya canjeó. Mejorarlo así:

- Si el cliente tiene programa de lealtad en este restaurante con ≥ puntos para alguna recompensa:
  - Mostrar dos modos en la sección "Aplicar puntos":
    - **Canjes pendientes** (si los hay) — selector actual.
    - **Canjear ahora** — selector de recompensas disponibles + cantidad de puntos a aplicar. Al confirmar, dispara `redeem` y luego usa la `redemption` recién creada para la distribución.
- Esto unifica el flujo: el cliente decide en checkout, no antes.

### 5.3 Cambios backend

**Endpoint nuevo:** cancelación de canje pendiente.

```python
# CustomerLoyaltyViewSet
@action(detail=True, methods=["delete"], url_path="redemptions")
def cancel_redemption(self, request, pk=None):
    # 1. Buscar LoyaltyRedemption del usuario en estado pending
    # 2. Crear LoyaltyTransaction con tx_type="redemption_cancelled" y +points
    # 3. Sumar al loyalty_account.current_points
    # 4. Si la reward tenía available_quantity, devolver +1
    # 5. Marcar redemption como cancelled
```

Esto requiere también un nuevo `LoyaltyRedemptionStatus` con código `cancelled` (lo crea on-demand `get_or_create` como ya hacen los demás).

**Endpoint nuevo:** listar recompensas disponibles **canjeables** para el cliente en un restaurante:

Hoy `CustomerLoyaltyViewSet.list` retorna `available_rewards` basado en favoritos. Para el checkout necesitamos filtrado por `restaurant_id` puntual y por `points_cost <= current_points`. Se puede:
- Reutilizar el endpoint existente pasando `?restaurant_id=...` (ya lo hace).
- Filtrar `available_rewards` por `points_cost <= current_points` (cambio menor en `views.py:63-66`).

### 5.4 Cambios frontend

Archivos a tocar:

- `frontend/src/pages/dashboard/cliente/puntos.jsx`: añadir secciones de "Recompensas" y "Mis canjes".
- `frontend/src/pages/checkout.jsx:242-310`: añadir modo "Canjear ahora" usando `useRedeemReward()`.
- `frontend/src/services/loyalty.js`: añadir `cancelRedemption(redemptionId)`.
- `frontend/src/hooks/use-loyalty.js`: añadir `useCancelRedemption()`.

### 5.5 Edge cases / decisiones

- **¿Qué pasa si el cliente cierra el checkout con un canje creado pero no aplicado?** Queda pending para usar después. Ya es el comportamiento actual. Está bien.
- **¿Puede haber múltiples canjes pendientes simultáneos?** El código actual lo permite. Mantenerlo así.
- **¿Caducan los canjes pending?** Hoy no. Decisión: dejar fuera de scope, se trata después.
- **Recompensas vs. "descuento puro" en puntos:** el modelo actual exige que TODO canje pase por una `LoyaltyReward`. Si el dueño quiere "100 puntos = $1.000 sin recompensa específica", tendría que crear una recompensa "Descuento de $1.000" con `points_cost=100`. Documentar esto en la ayuda de la pestaña Recompensas. Considerar para v2 un "canje libre".

### 5.6 Tests

- `backend/apps/loyalty/tests/test_api.py`: test del nuevo endpoint cancel — verifica que los puntos vuelven, que `available_quantity` se restablece, que un canje ya aplicado **no** se puede cancelar.
- Vitest: render del flujo "Canjear ahora" en checkout.
- E2E (opcional): cliente con puntos canjea y aplica al pedido — happy path.

---

## 6. Resumen de archivos a tocar

### Backend

- `backend/apps/menu/models.py` — añadir `earns_points`.
- `backend/apps/menu/migrations/0005_menuitemloyalty_earns_points.py` — schema + data migration.
- `backend/apps/menu/api/serializers.py` — incluir `earns_points` en read/write.
- `backend/apps/loyalty/services.py` — usar `earns_points` en `_eligible_total_amount`.
- `backend/apps/loyalty/api/views.py` — nuevo action `cancel_redemption`, filtrar recompensas canjeables.
- `backend/apps/loyalty/tests/test_services.py` + `test_api.py` — tests nuevos.

### Frontend

- `frontend/src/pages/dashboard/restaurante/menu.jsx` — switch "Da puntos", labels claros.
- `frontend/src/pages/dashboard/restaurante/lealtad.jsx` — partir en sub-componentes:
  - `lealtad/SettingsTab.jsx` con `InfoHint` por campo + resumen en vivo.
  - `lealtad/TiersTab.jsx` con edición controlada + botón Guardar.
  - `lealtad/RewardsTab.jsx` con modal de creación/edición.
  - `lealtad/RedemptionsTab.jsx` (solo refactor menor, queda casi igual).
- `frontend/src/components/ui/info-hint.jsx` — nuevo helper reutilizable.
- `frontend/src/components/restaurants/restaurant-menu.jsx` — mostrar badges "Gana puntos" / "Acepta canje" / "No gana puntos".
- `frontend/src/pages/dashboard/cliente/puntos.jsx` — secciones canjear y mis canjes.
- `frontend/src/pages/checkout.jsx` — modo "Canjear ahora" inline.
- `frontend/src/services/loyalty.js` + `frontend/src/hooks/use-loyalty.js` — `cancelRedemption`, refinamientos.

---

## 7. Fases de ejecución sugeridas

| Fase | Alcance | PR sugerido |
|------|---------|-------------|
| **F1** | Punto 3 + Punto 4: refactor de Niveles y Recompensas con estado local y modales. Resuelve el bug de tecleo. | PR pequeño, sin cambios de modelo. |
| **F2** | Punto 2: `InfoHint` reutilizable + popovers en Configuración. | Pequeño. |
| **F3** | Punto 1: modelo `earns_points` + migración + serializers + UI dueño + badges cliente. | Medio, requiere migración y QA. |
| **F4** | Punto 5: flujo de canje (dashboard cliente + checkout inline + cancel endpoint). | Más grande, dividir en sub-PRs si crece. |

Cada fase termina con:

- `dm python manage.py check`
- `dm python manage.py makemigrations --check` (cuando aplique)
- `dm pytest apps/loyalty apps/menu`
- `pnpm test:run` en frontend

---

## 8. Decisiones abiertas — confirmar antes de implementar

1. **Migración de `earns_points`**: ¿confirmas backfill con `earns_points = (config.allows_points_redemption OR config_inexistente)` para no romper el comportamiento histórico? (Recomendado en §1.2.)
2. **Niveles**: ¿ocultamos `max_points` y `code` del UI o los dejamos como "campos avanzados" plegables? (Recomiendo ocultar; el código y el max no se usan en lógica.)
3. **Canje en checkout**: ¿preferís unificar todo el canje en checkout (cliente nunca va al dashboard a canjear, lo hace ahí mismo) o mantener ambas puertas — dashboard + checkout? (El plan propone ambas, pero ambas funcionan.)
4. **Cancelación de canje**: ¿permitimos cancelar canjes pendientes desde el cliente, o solo desde el dueño? (Plan propone cliente; alternativa: solo dueño.)
5. **Vencimiento de canjes pendientes**: ¿en este plan o lo dejamos para una iteración futura? (Recomiendo futuro.)
6. **VIP threshold**: el campo `vip_threshold_orders` está en el modelo y la UI pero no se aplica en código. ¿Lo dejamos visible con la nota "próximamente" o lo escondemos hasta que tenga lógica detrás?

---

> **Listo para revisión.** Marca cualquier decisión en §8 antes de empezar la implementación.
