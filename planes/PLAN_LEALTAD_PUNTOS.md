# Plan de implementación — Sistema de Lealtad / Puntos por restaurante

> Estado: **borrador para validación**. No iniciar implementación hasta confirmación del usuario.
>
> Fecha: 2026-05-15
>
> Autor: Claude (Opus 4.7)

---

## 1. Resumen ejecutivo

Hoy existe un sistema de lealtad **a medias**:

- ✅ Modelos completos (`RestaurantLoyaltySetting`, `LoyaltyAccount`, `LoyaltyTier`, `LoyaltyReward`, `LoyaltyTransaction`, `LoyaltyRedemption`).
- ✅ Servicio que asigna puntos cuando una orden pasa a `delivered` (`apps/loyalty/services.py` → `assign_points_for_order`).
- ✅ Endpoint para que el **cliente** vea sus puntos por restaurante (`GET /api/customer/loyalty/`).
- ✅ Vista del cliente (`/dashboard/cliente/puntos`) que consume ese endpoint.
- ✅ La vista de Clientes del restaurante muestra una columna **Puntos** y **Tier** por cliente.
- ❌ **No hay API ni UI** para que el dueño/operador configure `RestaurantLoyaltySetting` (`is_active`, `currency_unit_amount`, `points_earned`).
- ❌ **No hay API ni UI** para gestionar recompensas (`LoyaltyReward`).
- ❌ **No hay endpoint ni flujo de canje** (botón "Canjear" del cliente no hace nada).
- ❌ Los **niveles (Tiers)** del frontend están **hardcoded** y no provienen del backend.
- ❌ Si el programa de lealtad **está desactivado** o no existe configuración, la UI igual muestra "0 puntos" sin distinguir el caso.
- ❌ `assign_points_for_order` se dispara **solo en `delivered`**, lo que rompe el flujo para pickup/mesa cuyo estado final puede ser distinto.
- ❌ No hay reversión de puntos cuando se cancela una orden que ya los otorgó.

Este plan agrega: **configuración por restaurante, CRUD de recompensas, flujo de canje aplicado en checkout, niveles por restaurante, permisos de operador y reversión automática**.

---

## 2. Decisiones validadas con el usuario

| # | Decisión | Resultado |
|---|---|---|
| 1 | UI de equivalencia | **2 entradas**: `currency_unit_amount` (ej. 1000) + `points_earned` (ej. 2) |
| 2 | Trigger de asignación | Al pasar a estado **final por tipo de orden** (`delivered` para delivery, `completed` para pickup/mesa) |
| 3 | Alcance | CRUD de recompensas **+ canje aplicado en checkout** |
| 4 | Tiers (niveles) | **Por restaurante** — refactor del modelo |
| 5 | Reversión al cancelar | **Automática** (transacción negativa) |
| 6 | Aplicación del canje | Integrada al **checkout**, el cliente decide aplicarla. Cada **producto** tiene opt-in con min/max canjeable por ítem. Restaurante define **tope global** por orden |
| 7 | Permisos | Nuevo módulo **`lealtad`** en `operator_permissions` (view/create/edit/delete) |

---

## 3. Problemas detectados en el estado actual

### 3.1 Backend
- `apps/loyalty/services.py:assign_points_for_order`
  - Solo evalúa `if next_status.code == "delivered"` (en `orders/api/views.py:226`). Para pickup/mesa el estado final natural puede ser `completed` u otro. No hay tabla canónica que mapee "estado final por tipo de orden".
  - No hay reversión cuando una orden delivered/completed pasa a `cancelled`.
  - El cálculo `int(total_amount / currency_unit_amount) * points_earned` está bien conceptualmente; pero conviene **redondear hacia abajo de forma explícita** y aceptar `Decimal` sin perder precisión.
  - Crea silenciosamente un tier "Base" si no existe ninguno — esto debería ser parte de un seed/`post_migrate` por restaurante, no on-the-fly.
- `RestaurantLoyaltySetting`
  - `currency_unit_amount` no tiene validación `> 0`; sí lo valida el servicio antes de calcular, pero un valor 0 guardado en DB es válido.
  - No tiene campo para **tope máximo de puntos canjeables por orden** ni **tope máximo de puntos por orden ganados** (anti-abuso).
- `LoyaltyTier`
  - Es global (sin FK a restaurante). El frontend hardcodea Bronce/Plata/Oro/Platino con umbrales fijos. Si un restaurante quiere su propio esquema, no se puede.
- `LoyaltyReward`
  - No tiene campos para limitar canjes (cantidad disponible, máximo por usuario, fecha de validez).
- `LoyaltyRedemption`
  - El modelo está, pero **no se llama desde ningún lado**. No hay flujo de canje.
- Permisos
  - El módulo `clientes` cubre la vista de listado, pero no existe `lealtad` en `operator_permissions`. La configuración hoy solo puede tocarse desde Django Admin.

### 3.2 Frontend
- `pages/dashboard/cliente/puntos.jsx`
  - Array `LEVELS` hardcoded — no coincide necesariamente con el backend.
  - Si el endpoint devuelve `current_level = "Varios"` (cuando hay múltiples cuentas), `LEVELS.find` retorna `undefined` → `LEVELS[0]` (Bronce) — UX engañosa.
  - Botón **"Canjear"** no tiene handler.
  - No hay UX para distinguir "este restaurante no tiene programa activo" vs. "tienes 0 puntos".
- `pages/dashboard/restaurante/clientes.jsx`
  - Si `LoyaltyAccount` no existe para un cliente, asume `tier="Base"` y `points=0` aunque el programa esté apagado — confunde al dueño.
  - VIP se decide con `points >= 1000` hardcoded en backend (`apps/restaurants/api/views.py:266`) — desacoplar. **Decisión:** se reemplaza por umbral de **pedidos completados** (`total_orders >= vip_threshold_orders`), configurable por restaurante con default 100.
- `pages/dashboard/restaurante/configuracion.jsx`
  - No hay tab/sección "Lealtad". Hoy un dueño no puede activar el programa ni definir la equivalencia.
- `components/dashboard/owner/owner-sidebar.jsx`
  - No hay entrada para "Lealtad" ni para "Recompensas".

---

## 4. Cambios a implementar

### 4.1 Backend — modelos y migraciones

**Archivo: `backend/apps/loyalty/models.py`**

1. `RestaurantLoyaltySetting`
   - Agregar:
     - `max_redeemable_points_per_order = PositiveIntegerField(null=True, blank=True)` — tope global de puntos canjeables por orden.
     - `max_points_per_order = PositiveIntegerField(null=True, blank=True)` — anti-abuso al ganar.
     - `vip_threshold_orders = PositiveIntegerField(default=100)` — un cliente se considera VIP cuando supera esta cantidad de pedidos completados (delivered/completed, excluyendo cancelados). Default 100, editable por el dueño.
   - Validación de modelo: `clean()` que exija `currency_unit_amount > 0` y `points_earned > 0` cuando `is_active=True`.

2. `LoyaltyTier`
   - Añadir `restaurant = ForeignKey('restaurants.Restaurant', null=True, blank=True, on_delete=CASCADE, related_name='loyalty_tiers')`.
   - `null=True` durante migración para mantener compatibilidad; luego una **data migration** que clone los tiers globales hacia cada restaurante con `loyalty_setting`, y deje a los tiers globales como `restaurant=None` (fallback) — o los elimine si se decide.
   - `Meta.unique_together = ("restaurant", "code")`.
   - Helper en `apps/loyalty/services.py:get_tier_for(restaurant, lifetime_points)` que devuelve el tier correcto (primero busca por restaurante, si no existe usa el global).

3. `LoyaltyReward`
   - Agregar:
     - `available_quantity = PositiveIntegerField(null=True, blank=True)` (null = ilimitado).
     - `max_per_user = PositiveIntegerField(null=True, blank=True)`.
     - `valid_until = DateField(null=True, blank=True)`.

4. **Nuevo modelo `MenuItemLoyaltyConfig`** en `apps/menu/models.py`:
   ```python
   class MenuItemLoyaltyConfig(BaseModel):
       menu_item = models.OneToOneField('menu.MenuItem', related_name='loyalty_config', on_delete=CASCADE)
       allows_points_redemption = models.BooleanField(default=False)
       min_points_redeemable = models.PositiveIntegerField(default=0)
       max_points_redeemable = models.PositiveIntegerField(null=True, blank=True)
   ```
   Esto permite que el restaurante diga "este producto admite descuento por puntos, mínimo X y máximo Y puntos".

5. `LoyaltyRedemption`
   - Agregar `order = ForeignKey('orders.Order', null=True, blank=True, on_delete=SET_NULL, related_name='loyalty_redemptions')` para vincular el canje al pedido donde se aplicó.
   - Agregar `points_applied = PositiveIntegerField()` (lo realmente descontado en pesos equivalentes).
   - Si la recompensa se canjeó pero aún no se usó, `order` queda `null`.

**Migraciones necesarias:**
- `loyalty/0003_loyalty_tier_restaurant_and_setting_caps.py` (modelo)
- `loyalty/0004_data_migrate_tiers_per_restaurant.py` (data migration)
- `loyalty/0005_reward_constraints_redemption_order.py` (campos extra)
- `menu/000X_menu_item_loyalty_config.py`

### 4.2 Backend — catálogo de estados finales

**Archivo nuevo: `backend/apps/orders/constants.py`** (o reusar uno existente)
```python
FINAL_STATUS_BY_ORDER_TYPE = {
    "delivery": "delivered",
    "pickup": "completed",
    "dine_in": "completed",
}
```

**Archivo: `apps/orders/api/views.py`** (línea 226)
- Reemplazar `if next_status.code == "delivered"` por:
  ```python
  if next_status.code == FINAL_STATUS_BY_ORDER_TYPE.get(order.order_type.code):
      assign_points_for_order(order)
  ```
- En la acción `cancel` (línea ~233): después de marcar como cancelado, llamar a `revert_points_for_order(order)` (servicio nuevo) si la orden estaba en estado final.

### 4.3 Backend — servicios

**Archivo: `apps/loyalty/services.py`**

1. `assign_points_for_order(order)`
   - Validar idempotencia: no asignar dos veces para la misma orden (revisar si ya existe `LoyaltyTransaction` con `order=order` y `tx_type.code='earned_purchase'`).
   - Aplicar `max_points_per_order` si está definido.
   - Usar `get_tier_for(restaurant, lifetime_points)`.

2. Nuevo: `revert_points_for_order(order)`
   - Si existe transacción `earned_purchase` para la orden, crear `earned_purchase_reverted` con `points_delta` negativo igual a lo otorgado.
   - Recalcular `current_points` y `tier`.

3. Nuevo: `redeem_reward(user, reward, points)` (descuenta puntos al elegir canje en checkout o pre-canje)
   - Validaciones: cuenta del usuario existe, recompensa activa, puntos disponibles, `available_quantity`, `max_per_user`, `valid_until`.
   - Crea `LoyaltyTransaction` con `points_delta = -points`.
   - Crea `LoyaltyRedemption` con `status=pending` (uso aún no aplicado).
   - Decrementa `available_quantity` si aplica.

4. Nuevo: `apply_redemption_to_order(order, redemption, line_overrides)`
   - Llamado desde el checkout cuando el cliente elige aplicar puntos.
   - Valida que `MenuItemLoyaltyConfig` permita canje en cada ítem y respete min/max.
   - Aplica el `max_redeemable_points_per_order` global.
   - Asocia `redemption.order = order` y `status=applied`.
   - Devuelve el descuento total en pesos para que `orders.services.calculate_total` lo reste.

### 4.4 Backend — API

**Archivo: `apps/loyalty/api/views.py`** (extender)

Endpoints nuevos:

| Método | Ruta | Permisos | Descripción |
|---|---|---|---|
| GET | `/api/owner/restaurants/{id}/loyalty-setting/` | `LealtadModulePermission(view)` | Devuelve `RestaurantLoyaltySetting` |
| PUT/PATCH | `/api/owner/restaurants/{id}/loyalty-setting/` | `LealtadModulePermission(edit)` | Actualiza configuración |
| GET | `/api/owner/restaurants/{id}/loyalty-tiers/` | `LealtadModulePermission(view)` | Lista tiers |
| POST/PUT/DELETE | `/api/owner/loyalty-tiers/{tier_id}/` | `LealtadModulePermission(create/edit/delete)` | CRUD tiers |
| GET | `/api/owner/restaurants/{id}/loyalty-rewards/` | `LealtadModulePermission(view)` | Lista recompensas |
| POST/PUT/DELETE | `/api/owner/loyalty-rewards/{reward_id}/` | `LealtadModulePermission(create/edit/delete)` | CRUD recompensas |
| GET | `/api/owner/restaurants/{id}/loyalty-redemptions/` | `LealtadModulePermission(view)` | Canjes realizados |
| POST | `/api/customer/loyalty/redeem/` | `IsAuthenticatedUser` | Cliente canjea (descuenta puntos y crea `LoyaltyRedemption`) |
| GET | `/api/customer/loyalty/redemptions/?status=pending` | `IsAuthenticatedUser` | Recompensas canjeadas y no usadas |

Modificar checkout (`apps/orders/api/views.py:CheckoutViewSet`):
- Aceptar en el payload: `loyalty_redemption_id` (opcional) y `line_redemptions: [{order_item_index, points_to_apply}]`.
- Validar y aplicar `apply_redemption_to_order` antes de calcular el total.

**Archivo: `apps/core/permissions.py`**
- Agregar `LealtadModulePermission(OperatorModulePermission)` con `module = "lealtad"`.
- Actualizar el catálogo `operator_permissions` por defecto (`apps/restaurants/services.py:32`) para incluir `lealtad`.

**Archivo: `config/api_router.py`**
- Registrar nuevos viewsets.

### 4.5 Backend — serializers

Nuevos en `apps/loyalty/api/serializers.py`:
- `RestaurantLoyaltySettingSerializer`
- `LoyaltyTierSerializer`
- `LoyaltyRewardSerializer`
- `LoyaltyRedemptionSerializer`
- `RedeemRewardRequestSerializer`
- `MenuItemLoyaltyConfigSerializer` (puede ir en menu)

### 4.6 Frontend — services y hooks

**Archivo nuevo: `frontend/src/services/loyalty.js`**
```js
export function getOwnerLoyaltySetting(restaurantId) { ... }
export function updateOwnerLoyaltySetting(restaurantId, payload) { ... }
export function getOwnerLoyaltyTiers(restaurantId) { ... }
export function createOwnerLoyaltyTier(payload) { ... }
export function updateOwnerLoyaltyTier(tierId, payload) { ... }
export function deleteOwnerLoyaltyTier(tierId) { ... }
export function getOwnerLoyaltyRewards(restaurantId) { ... }
export function createOwnerLoyaltyReward(payload) { ... }
export function updateOwnerLoyaltyReward(rewardId, payload) { ... }
export function deleteOwnerLoyaltyReward(rewardId) { ... }
export function redeemReward(payload) { ... }
export function getCustomerRedemptions(status) { ... }
```

**Archivo nuevo: `frontend/src/hooks/use-loyalty.js`**
- `useOwnerLoyaltySetting(restaurantId)` — load/save.
- `useOwnerLoyaltyTiers(restaurantId)` — CRUD con estado optimista.
- `useOwnerLoyaltyRewards(restaurantId)` — CRUD.
- `useRedeemReward()` — mutación.
- `useCustomerRedemptions()` — lista de canjes pendientes para mostrar en checkout.

**Modificar `frontend/src/hooks/use-orders.js`**
- `useCustomerLoyalty` debe devolver además: `is_active` (bool), `currency_unit_amount`, `points_earned`, `tiers` (lista del backend), para que `puntos.jsx` deje de hardcodear.

### 4.7 Frontend — UI restaurante

**Nuevo: `pages/dashboard/restaurante/lealtad.jsx`** (página completa con tabs)

Tabs:
1. **Configuración**
   - Switch `is_active`.
   - Inputs `currency_unit_amount` (pesos) y `points_earned` (puntos).
   - Preview en vivo: "Por cada $X tus clientes ganan N puntos. Un pedido de $50.000 = M puntos."
   - Inputs opcionales `max_points_per_order` (ganados) y `max_redeemable_points_per_order` (canjeables).
   - Input `vip_threshold_orders` (cantidad de pedidos completados para considerar a un cliente VIP, default 100). Tooltip: "Un cliente aparece como VIP en tu lista cuando supera esta cantidad de pedidos finalizados."

2. **Niveles (Tiers)**
   - Lista de tiers con nombre, min_points, max_points y badge de color.
   - CRUD inline.

3. **Recompensas**
   - Lista con name, description, points_cost, available_quantity, max_per_user, valid_until, is_active.
   - CRUD.

4. **Canjes**
   - Tabla de `LoyaltyRedemption` con cliente, recompensa, fecha, estado, orden asociada (si aplica). Read-only.

**Modificar `pages/dashboard/restaurante/menu.jsx`**
- En el formulario de cada ítem, agregar sección "Canje con puntos":
  - Switch `allows_points_redemption`.
  - Inputs `min_points_redeemable`, `max_points_redeemable`.

**Modificar `components/dashboard/owner/owner-sidebar.jsx`**
- Agregar entrada "Lealtad" con icono `Award` en `menuItems` y en `MODULE_MAP`.

**Modificar `pages/dashboard/restaurante/clientes.jsx`**
- Si el restaurante no tiene programa activo, mostrar banner: "Tu programa de puntos está desactivado. Actívalo en Configuración › Lealtad."
- Quitar la columna "Puntos/Tier" o deshabilitarla cuando el programa está apagado.
- Cambiar el cálculo de VIP en backend (`apps/restaurants/api/views.py:266`): contar pedidos finales (excluyendo cancelados) y comparar contra `RestaurantLoyaltySetting.vip_threshold_orders` (default 100). El campo `total_orders` ya está disponible en el queryset (`row["total_orders"]`).

### 4.8 Frontend — UI cliente

**Modificar `pages/dashboard/cliente/puntos.jsx`**
- Eliminar `LEVELS` hardcoded; usar `data.tiers` del backend.
- Manejar `current_level = "Varios"` mostrando una sección distinta (no progreso a siguiente nivel) cuando no hay `restaurant_id`.
- Si el restaurante seleccionado tiene `is_active=false`, mostrar "Este restaurante no participa en el programa de puntos".
- Implementar el botón **Canjear**: confirm + `redeemReward` + refrescar.

**Modificar checkout (`pages/checkout/*` o equivalente)**
- Después de seleccionar productos, mostrar sección "Aplicar puntos":
  - Lista de canjes pendientes del usuario (`useCustomerRedemptions`).
  - O directamente, si el ítem tiene `allows_points_redemption`, slider/input de puntos a aplicar (entre min/max).
  - Mostrar total con descuento aplicado.
  - Respetar `max_redeemable_points_per_order`.

### 4.9 Permisos y double-gate

- Agregar "lealtad" al objeto `operator_permissions` por defecto en `apps/restaurants/services.py`.
- En `App.jsx`, la ruta `/dashboard/restaurante/lealtad` debe estar gateada con `<ProtectedRoute allowedRoles={["restaurante","dueno","operador"]}>` (operador con permiso `lealtad.can_view`).
- En el sidebar, filtrar por `operator_permissions.lealtad.can_view`.

### 4.10 Signals y notificaciones

Mantener `loyalty/signals.py`. Agregar:
- Notificación `loyalty.points_reverted` cuando se revierte por cancelación.
- Notificación `loyalty.reward_canjeado` (ya existe `loyalty.reward_redeemed`, reusar).

---

## 5. Plan de pruebas

### Backend (`pytest`)
- `loyalty/tests/test_setting_api.py`
  - Solo dueño/admin/operador-con-permiso puede leer/escribir setting.
  - Validar errores cuando `currency_unit_amount=0` y `is_active=True`.
- `loyalty/tests/test_services.py`
  - `assign_points_for_order` con setting activo/inactivo, idempotencia, `max_points_per_order`.
  - `revert_points_for_order` reduce correctamente sin dejar saldo negativo.
  - `redeem_reward` valida `available_quantity`, `max_per_user`, `valid_until`.
  - `apply_redemption_to_order` respeta `MenuItemLoyaltyConfig` y tope global.
- `loyalty/tests/test_tiers.py`
  - Tier por restaurante con fallback global.
- `orders/tests/test_loyalty_integration.py`
  - Cambio de estado a estado final por tipo de orden dispara asignación.
  - Cancelación revierte.
  - Checkout con `loyalty_redemption_id` aplica descuento.

### Frontend (Vitest + Playwright)
- Vitest: hooks `useOwnerLoyaltySetting`, `useRedeemReward` (mock fetch).
- Playwright (`e2e/`):
  - Dueño activa programa → cliente hace pedido → ve puntos.
  - Cliente canjea recompensa → checkout aplica descuento → restaurante ve canje.
  - Operador sin permiso `lealtad` no ve el menú.

---

## 6. Fases de entrega sugeridas

Para no hacer un PR gigante, sugerir cortar así:

| Fase | Alcance | Riesgo |
|---|---|---|
| **F1** | Backend: extender modelos, migraciones (incl. tiers por restaurante), permisos `lealtad`. CRUD setting + tiers + rewards. UI restaurante: tab "Configuración" y "Niveles". | Bajo |
| **F2** | Trigger ajustado por tipo de orden + reversión al cancelar + tests. | Bajo |
| **F3** | Vista cliente reescrita (sin LEVELS hardcoded, banner si inactivo). Vista del restaurante: banner si inactivo. | Bajo |
| **F4** | CRUD de recompensas en UI + endpoint `redeem` + UI cliente "Mis canjes". (Aún sin checkout.) | Medio |
| **F5** | `MenuItemLoyaltyConfig` + UI en menú + integración con checkout (cliente elige puntos por ítem, respeta topes). | Alto |
| **F6** | E2E Playwright completo + documentación en CLAUDE.md/AGENTS.md. | Bajo |

---

## 7. Preguntas abiertas (a confirmar antes / durante la implementación)

1. **Tope vs distribución del canje por orden**: cuando el cliente tiene 5.000 puntos y el tope global es 2.000, ¿el cliente decide cómo distribuir esos 2.000 entre productos canjeables, o el sistema distribuye proporcionalmente? **Sugerencia:** el cliente decide manualmente, el sistema solo valida topes.
Respuesta: Tener en cuenta que los puntos son por restaurante, y se solicita el tope y las equivalencias al momento de activar el programa de recompensas por puntos, y ademas el cliente no debe tener mas puntos que el tope del restaurante, cuando se llegue al tope, al usuario se le informa que no puede tener mas puntos, que se recomienda utilzarlo en los productos habilitados.
2. **Valor de 1 punto al canjear**: ¿1 punto canjeable equivale a 1 peso, o se define explícitamente en `RestaurantLoyaltySetting.redeem_value` (ej. 1 punto = 2 pesos)? El modelo actual no tiene este campo.
**Sugerencia:** agregar `point_redeem_value = DecimalField(default=1)` y usarlo en `apply_redemption_to_order`.
Respuesta: No tenga un valor por defecto sino que este None o vacio, ya que se pondria cuando el restaurante active el sistema de recompensas
3. ~~**VIP threshold**~~: **RESUELTO** — VIP se calcula por **cantidad de pedidos completados** (no por puntos). Campo `vip_threshold_orders` en `RestaurantLoyaltySetting`, default 100, editable por el dueño.
Respuesta: 
4. **Tiers globales existentes**: ¿conservamos los tiers globales como fallback o eliminamos en una migración? **Sugerencia:** conservar como fallback hasta que cada restaurante configure los suyos.
5. **Reseteo de puntos por inactividad**: ¿caducan puntos después de N días sin actividad? Por ahora no — proponer como fase futura.
Respuesta: Si, que un trigger de expiracion de puntos se ejecute una vez al dia, se debe analizar como rastrear los puntos por restaurante
6. **Operador con permiso `lealtad`**: ¿hereda automáticamente el permiso de "ver clientes" para asociar canjes con clientes? **Sugerencia:** no; revisar caso a caso en backend.
7. **¿Dueños con varios restaurantes?**: el setting es OneToOne; la UI debe permitir seleccionar restaurante si el dueño tiene >1. Hoy `use-orders.js` siempre usa `restaurants[0]` — esto ya es una deuda independiente, pero conviene resolverla antes de F1.
Respuesta: Si, analizar bien como se implementa que el dueño vea todos sus restaurantes y pueda seleccionar el que quiera gestionar, como tambien agregar un permiso sobre que restaurantes puede operarar sus operadores
8. **Notificación WebSocket al restaurante** cuando un cliente canjea: ¿necesaria o basta con que aparezca en el dashboard al refrescar?
Respuesta: basta con que aparezca en el dashboard al refrescar
9. **¿Pago confirmado obligatorio para asignar puntos?**: si la orden es online y `payment_status='pending'`, ¿asignamos al pasar a estado final igual? **Sugerencia:** asignar solo si `payment_status in {completed, cash_on_delivery_confirmed}`.
Respuesta: asignar solo si `payment_status in {completed, cash_on_delivery_confirmed}`, o cualquier estado relacionado a que ya este pagado y completado

---

## 8. Archivos que se tocan (resumen)

### Backend
- `apps/loyalty/models.py`
- `apps/loyalty/services.py`
- `apps/loyalty/signals.py`
- `apps/loyalty/api/views.py` *(nuevo split en archivos por recurso)*
- `apps/loyalty/api/serializers.py` *(nuevo)*
- `apps/loyalty/api/urls.py` *(nuevo si separamos)*
- `apps/loyalty/migrations/000{3,4,5}_*.py` *(nuevos)*
- `apps/menu/models.py` (MenuItemLoyaltyConfig)
- `apps/menu/api/serializers.py`, `views.py`
- `apps/orders/api/views.py` (CheckoutViewSet, status action, cancel action)
- `apps/orders/services.py` (cálculo de totales con redemption)
- `apps/orders/constants.py` *(nuevo)*
- `apps/core/permissions.py` (LealtadModulePermission)
- `apps/restaurants/services.py` (módulo `lealtad` en operator_permissions por defecto)
- `apps/restaurants/api/views.py` (vista de clientes: quitar VIP hardcoded)
- `config/api_router.py`
- Tests en `apps/loyalty/tests/`, `apps/orders/tests/`

### Frontend
- `src/services/loyalty.js` *(nuevo)*
- `src/hooks/use-loyalty.js` *(nuevo)*
- `src/hooks/use-orders.js` (extender `useCustomerLoyalty`)
- `src/pages/dashboard/restaurante/lealtad.jsx` *(nuevo)*
- `src/pages/dashboard/restaurante/clientes.jsx`
- `src/pages/dashboard/restaurante/menu.jsx`
- `src/pages/dashboard/cliente/puntos.jsx`
- `src/components/dashboard/owner/owner-sidebar.jsx`
- `src/App.jsx` (registrar ruta `/lealtad` con double-gate)
- Páginas de checkout (aplicación del canje)
- `e2e/loyalty-*.spec.js` *(nuevos)*

---

## 9. Estimación gruesa

| Fase | Backend | Frontend | Tests | Total |
|---|---|---|---|---|
| F1 | 1.5d | 1d | 0.5d | 3d |
| F2 | 0.5d | — | 0.5d | 1d |
| F3 | — | 1d | 0.5d | 1.5d |
| F4 | 1d | 1.5d | 0.5d | 3d |
| F5 | 2d | 2d | 1d | 5d |
| F6 | — | — | 1d | 1d |
| **Total** | **5d** | **5.5d** | **4d** | **~14.5d** |

> Estimación calendario, asume desarrollo en paralelo back/front en algunos días.

---

## 10. Criterios de aceptación

- [ ] Un dueño puede activar/desactivar el programa de puntos desde el dashboard.
- [ ] Un dueño puede definir "X pesos = N puntos" desde el dashboard, con preview.
- [ ] Un dueño puede crear/editar tiers propios.
- [ ] Un dueño puede crear/editar recompensas con cantidad disponible y máximo por usuario.
- [ ] Un dueño puede activar canje por puntos en un producto del menú, con min/max.
- [ ] Un operador con permiso `lealtad.can_view` ve el menú; sin permiso, no lo ve.
- [ ] Un cliente ve sus puntos correctamente segmentados por restaurante; los niveles vienen del backend.
- [ ] Un cliente puede canjear una recompensa; los puntos se descuentan; aparece en "Mis canjes pendientes".
- [ ] Un cliente puede aplicar puntos en checkout sobre productos elegibles, respetando topes; el descuento se refleja en el total.
- [ ] Cuando una orden pasa a estado final (delivered/completed según tipo), se asignan los puntos.
- [ ] Cuando una orden con puntos asignados se cancela, los puntos se revierten.
- [ ] Tests backend y E2E pasando.

---

> **Listo para revisión.** Marca cualquier cambio en preguntas abiertas (sección 7) o sugerencias (sección 8) antes de empezar.
