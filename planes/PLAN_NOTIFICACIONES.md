# Plan — Sistema de notificaciones WebSocket permission-aware

## Contexto

Hoy el proyecto solo emite notificaciones WebSocket para **pedidos** (3 consumers en `apps/orders/`). Esto crea varios huecos importantes:

1. **Sin filtrado por permiso de operador.** Un operador del rol `restaurante` se conecta al canal del dueño (`/api/ws/orders/{owner_id}/`) y recibe **todos** los pedidos sin que se verifique si el operador tiene `operator_permissions.pedidos.can_view`. Lo mismo aplicaría a otros módulos cuando se agreguen.
2. **Solo existen eventos de pedidos.** No hay notificaciones realtime para stock bajo, nuevas reseñas, ítems de menú agotados, lealtad, invitaciones aceptadas, etc.
3. **Riesgo de suplantación en `GuestOrderConsumer`.** Cualquiera con el `order_id` (UUID) se conecta al canal del pedido invitado — no se valida el `tracking_code`.
4. **Riesgo de suplantación en consumers de owner.** Aunque hoy `OwnerOrderConsumer` y `UserOrderConsumer` validan que `scope.user.id == owner_id/user_id` del path, **el patrón de exponer el ID en el path es frágil**: cualquier consumer nuevo que olvide esta validación introduce una vía de escalación (cambiar el UUID del path para escuchar otro grupo con un token válido propio).
5. **No hay reconexión** en el cliente, ni un cliente WS centralizado. Cada hook abre su propio socket.
6. **El NotificationCenter del header se llena solo por REST.** No recibe push realtime, por lo que el badge no se incrementa al vuelo.

El objetivo es reemplazar este sistema con uno **unificado, permission-aware y seguro por defecto**: una sola conexión WS por sesión, los grupos se derivan del `scope.user` (nunca de un ID del path), y el operador solo recibe eventos de los módulos que tiene autorizados.

---

## Lista completa de eventos a notificar

Cada evento se identifica por `event_type` y se asocia a un **módulo de permiso** (`pedidos`, `menu`, `inventario`, `clientes`, `resenas`, `analiticas`, `configuracion`) o al canal personal del usuario.

### Eventos para Dueño / Operador (filtrados por `operator_permissions[modulo].can_view`)

| Evento | Módulo | Disparador (archivo:línea aprox.) |
|---|---|---|
| `order.created` | `pedidos` | `orders/api/serializers.py:276` (CheckoutSerializer.create) |
| `order.status_changed` | `pedidos` | `orders/api/views.py:228` (OwnerOrderViewSet.status) |
| `order.cancelled` | `pedidos` | `orders/api/views.py:182, 260` (cancel) |
| `order.payment_completed` | `pedidos` | nuevo — al crear `OrderPaymentTransaction` con status=completed |
| `order.payment_failed` | `pedidos` | nuevo — al crear `OrderPaymentTransaction` con status=failed |
| `menu_item.created` | `menu` | `menu/api/views.py` (OwnerMenuCrudItemViewSet) |
| `menu_item.updated` | `menu` | idem |
| `menu_item.availability_changed` | `menu` | idem (toggle `is_available`) |
| `menu_item.out_of_stock` | `menu` | derivado al detectar que un ingrediente quedó en 0 |
| `inventory.low_stock` | `inventario` | `menu/models.py` InventoryStockMovement post_save cuando `current_stock <= min_stock` |
| `inventory.out_of_stock` | `inventario` | idem cuando `current_stock == 0` |
| `inventory.movement` | `inventario` | post_save de `InventoryStockMovement` |
| `customer.first_order` | `clientes` | hook en `notify_restaurant_new_order` cuando es el primer pedido del usuario en ese restaurante |
| `customer.favorited` | `clientes` | post_save de `customers.Favorite` |
| `review.created` | `resenas` | post_save de `RestaurantReview` |
| `review.low_rating` | `resenas` | idem cuando rating ≤ 2 (envía además del `review.created`) |
| `operator.invitation_accepted` | `configuracion` | cuando `OperatorInvitation.accepted_at` se setea |
| `restaurant.status_changed` | `configuracion` | post_save de `Restaurant` cuando cambia `status` |

### Eventos para Cliente autenticado (canal personal `user-{id}`)

| Evento | Disparador |
|---|---|
| `order.status_changed` | mismo trigger que el del dueño, doble fan-out |
| `order.cancelled` | idem |
| `order.payment_completed` | idem |
| `order.payment_failed` | idem |
| `loyalty.points_earned` | `loyalty/services.py` assign_points_for_order |
| `loyalty.tier_upgraded` | `loyalty/services.py:72-77` |
| `loyalty.reward_redeemed` | endpoint de canje |
| `review.replied` | cuando el dueño responde su reseña |

### Eventos para Cliente invitado (canal por pedido + tracking_code)

| Evento | Disparador |
|---|---|
| `order.status_changed` | doble fan-out del trigger del dueño |
| `order.cancelled` | idem |

---

## Arquitectura propuesta

### Backend

#### 1. Un consumer unificado para sesión autenticada

Reemplazar los 3 consumers actuales (`OwnerOrderConsumer`, `UserOrderConsumer`) por un solo **`SessionNotificationsConsumer`** en `apps/notifications/consumers.py`:

- **URL única:** `/api/ws/notifications/?access_token=…&active_role=cliente|restaurante|operador`
- **No hay ID en el path.** El consumer usa **exclusivamente `self.scope["user"].id`** para derivar a qué grupos suscribirse. Esto elimina la clase entera de ataques "cambia el UUID del path".
- **Determina los grupos a unirse según el rol activo:**
  - **cliente**: se une a `user-{user.id}`
  - **restaurante** (dueño): se une a `restaurant-{restaurant_id}-{modulo}` para **todos** los módulos del catálogo + `user-{user.id}`
  - **operador**: para cada `modulo` en `OPERATOR_MODULES` donde `operator_permissions[modulo].can_view == True`, se une a `restaurant-{operador.restaurante_id}-{modulo}` + `user-{user.id}`
- **Re-validación por mensaje** (defensa en profundidad): cuando el consumer recibe un evento del channel layer, antes de hacer `send_json` re-verifica que el usuario sigue teniendo permiso sobre ese módulo. Si los permisos del operador se revocaron mientras estaba conectado, el mensaje se descarta. La verificación lee de caché Redis con TTL corto (30s).
- **Validación de pertenencia (operador):** al conectar, valida que `Operador.objects.filter(user_id=user.id, restaurante_id=...)` existe y está activo. Si no, cierra con 4003.
- **Cambio de rol activo en caliente:** acepta un mensaje `{"type": "switch_role", "role": "..."}` que rehace los grupos sin reconectar el socket.

#### 2. `GuestOrderConsumer` con `tracking_code`

Mantener `/api/ws/guest-orders/{order_id}/` **pero requerir** `?tracking_code=…` y validar contra `Order.guest_tracking_code`. Si no coincide o el pedido pertenece a un usuario autenticado, cerrar con 4003.

#### 3. Dispatcher centralizado

Crear `apps/notifications/realtime.py` con la API pública:

```python
def notify_restaurant(restaurant_id, module, event_type, payload, persist=True)
def notify_user(user_id, event_type, payload, persist=True)
def notify_guest_order(order_id, event_type, payload)
```

- Si `persist=True`, además de `group_send` crea un `NotificationEvent` en BD para el `NotificationCenter`.
- Reemplaza `notify_restaurant_new_order`, `notify_order_cancelled`, `notify_order_status_updated` en `orders/services.py`.

Nombres de grupos (función helper):

```python
def restaurant_group(restaurant_id, module): return f"r-{restaurant_id}-{module}"
def user_group(user_id):                      return f"u-{user_id}"
def guest_order_group(order_id):              return f"g-{order_id}"
```

#### 4. Signals + integraciones

Agregar signals en las apps que aún no notifican. Conectarlos en `apps/<app>/apps.py` (método `ready`):

- `apps/restaurants/signals.py` → review post_save (review.created / review.low_rating), Restaurant post_save (status_changed), OperatorInvitation post_save (invitation_accepted)
- `apps/menu/signals.py` → MenuItem post_save (created/updated/availability_changed), InventoryStockMovement post_save (low_stock/out_of_stock/movement)
- `apps/customers/signals.py` → Favorite post_save
- `apps/loyalty/signals.py` → LoyaltyAccount/LoyaltyTransaction post_save (points_earned, tier_upgraded), LoyaltyRedemption post_save (reward_redeemed)
- `apps/orders/` → integrar pagos al crear `OrderPaymentTransaction`

Los signals deciden el `restaurant_id` y `module` y delegan a `realtime.notify_restaurant(...)`.

#### 5. Permisos: helper compartido

Reutilizar `operator_can(module, action, user)` de `apps/core/permissions.py` para la re-validación por mensaje. Cachear el dict de permisos por `user_id` en Redis con TTL de 30s para evitar query por evento.

### Frontend

#### 1. Cliente WS centralizado

`frontend/src/lib/realtime-client.js`:

- Mantiene **una sola conexión** a `/api/ws/notifications/?access_token=…&active_role=…`.
- Reconexión con backoff exponencial (1s → 2s → 4s → … máx 30s).
- Re-emite ping cada 25s para mantener viva la conexión.
- Pub/sub interno por `event_type` (`subscribe(eventType, handler) → unsubscribe()`).
- Al cambiar `activeRole` o `accessToken`, envía `{type: "switch_role", role}` o reconecta si el token cambió.

#### 2. Hook `useRealtimeNotifications()`

`frontend/src/hooks/use-realtime-notifications.js`:

- Se monta una sola vez en el layout raíz (`AppShell` o `App.jsx`).
- Inicializa el cliente con `user.id` y `activeRole`.
- Conecta los eventos al **NotificationCenter store** (mismo que hoy alimenta el dropdown del Bell) → al recibir un evento push hace `setItems([newEvent, ...items])` e incrementa `unreadCount`.
- Muestra `toast` para eventos clave (nuevo pedido, stock crítico, etc.).

#### 3. Eliminar hooks viejos

Borrar `use-owner-order-notifications.js` y sus tres exports. Migrar los consumidores actuales (`OwnerOrdersProvider`, `pedidos.jsx` del cliente) a `useRealtimeNotifications` filtrando por `event_type === "order.*"`.

#### 4. Filtrado UI por rol

El cliente confía en que el backend ya filtró por permiso. La UI **no necesita** verificar `operator_permissions` para mostrar/ocultar notificaciones — si llegan es porque el operador tiene el permiso. El filtrado UI se mantiene **solo** para esconder rutas/sidebar (lo que ya hace `owner-sidebar.jsx`).

---

## Archivos a crear / modificar

### Crear
- `backend/apps/notifications/consumers.py` — `SessionNotificationsConsumer`
- `backend/apps/notifications/routing.py` — patrones WS unificados
- `backend/apps/notifications/realtime.py` — dispatcher
- `backend/apps/notifications/permissions.py` — helper `groups_for_user(user, active_role)` con caché Redis
- `backend/apps/restaurants/signals.py` — review, restaurant status, operator invitation
- `backend/apps/menu/signals.py` — menu item, inventory
- `backend/apps/customers/signals.py` — favorite
- `backend/apps/loyalty/signals.py` — loyalty events
- `backend/apps/notifications/tests/test_consumer.py` — tests de seguridad
- `frontend/src/lib/realtime-client.js`
- `frontend/src/hooks/use-realtime-notifications.js`

### Modificar
- `backend/config/websocket.py` — apuntar a `notifications.routing.websocket_urlpatterns` (incluir también el guest)
- `backend/apps/orders/routing.py` — dejar solo `GuestOrderConsumer` con `tracking_code`
- `backend/apps/orders/consumers.py` — eliminar `OwnerOrderConsumer` y `UserOrderConsumer`; modificar `GuestOrderConsumer` para exigir `tracking_code`
- `backend/apps/orders/services.py` — reemplazar `notify_*` por llamadas a `realtime.notify_*`
- `backend/apps/orders/api/views.py` y `serializers.py` — actualizar imports
- `backend/apps/orders/tasks.py` — pagos: disparar `payment.completed/failed`
- `backend/apps/restaurants/apps.py`, `menu/apps.py`, `customers/apps.py`, `loyalty/apps.py` — registrar signals en `ready()`
- `frontend/src/App.jsx` o el shell de layouts — montar `useRealtimeNotifications` arriba
- `frontend/src/context/owner-orders-context.jsx` — quitar conexión propia, suscribirse al cliente central
- `frontend/src/pages/dashboard/cliente/pedidos.jsx` — idem
- `frontend/src/pages/mis-pedidos.jsx` — sigue usando guest WS pero ahora con `tracking_code`
- `frontend/src/hooks/use-orders.js` `useNotificationCenter` — exponer setter para que el push agregue items
- Borrar `frontend/src/hooks/use-owner-order-notifications.js`

---

## Seguridad — invariantes

1. **El backend nunca confía en IDs del path** para decidir el grupo. Siempre `self.scope["user"].id`.
2. **El tracking_code es el único path con ID en URL** y se valida contra BD en `connect()`.
3. **Token expirado durante la sesión**: middleware ya rechaza nuevas conexiones; para conexión activa, periódicamente (cada 5 min) el consumer revalida `user.is_active`.
4. **Operador con permiso revocado**: re-validación por mensaje impide que reciba eventos aunque el grupo lo siga teniendo (la limpieza del grupo se hace al cerrar la conexión o en el próximo `switch_role`).
5. **Operador activado/desactivado**: si el operador queda inactivo, próximo evento descartado + cierre forzado de la conexión (mensaje `{type: "session_revoked"}`).

---

## Verificación end-to-end

### Tests backend (pytest, `dm pytest apps/notifications/`)
- `test_consumer_rejects_unauthenticated` — sin token cierra con 4001
- `test_owner_joins_all_module_groups` — owner se suscribe a los 7 grupos del restaurante
- `test_operator_joins_only_permitted_modules` — operador con `pedidos.can_view=True, inventario.can_view=False` solo entra al grupo pedidos
- `test_operator_message_dropped_after_permission_revoked` — emitir evento, revocar permiso, emitir otro: solo el primero llega
- `test_guest_consumer_rejects_wrong_tracking_code`
- `test_role_switch_rejoins_groups`
- `test_low_stock_signal_fires_inventario_group` — crear stock movement debajo de min_stock dispara evento

### Manual (browser)
1. `docker compose -f docker-compose.local.yml up -d`
2. Login como dueño → abrir DevTools → confirmar **una sola** conexión WS al cargar dashboard
3. Crear un pedido desde otro tab (cliente o guest) → toast + badge del Bell incrementa sin recargar
4. Login como operador con permisos `pedidos: can_view` solo → crear pedido (llega) → ajustar stock al mínimo en otro tab (NO llega)
5. Dueño cambia permisos del operador en `/dashboard/restaurante/operadores` → operador sigue logueado → emitir evento de inventario → confirmar que ahora sí llega (re-validación)
6. Cliente autenticado en `/dashboard/cliente/pedidos` → owner cambia estado de un pedido suyo → llega push sin recargar
7. Cliente invitado en `/mis-pedidos` con `tracking_code` correcto → llega; manipular `tracking_code` en URL → conexión cerrada con 4003

---

## Decisiones confirmadas con el usuario

- **URL WS**: una sola conexión unificada `/api/ws/notifications/?access_token=…&active_role=…`. No se exponen IDs en el path para canales autenticados.
- **Permisos revocados durante la sesión**: re-validación por mensaje con caché Redis (TTL 30s).
- **Ejecución**: en 5 fases con commits separados (ver abajo). No avanzar a la siguiente fase hasta que la anterior pase tests.

## Estrategia de implementación (sugerida en fases)

1. **Fase 1 — infraestructura**: dispatcher `realtime.py`, `SessionNotificationsConsumer`, routing nuevo, cliente WS centralizado en frontend, migrar eventos de pedidos existentes (paridad funcional con hoy).
2. **Fase 2 — operadores permission-aware**: agregar lógica de grupos por módulo + re-validación + tests.
3. **Fase 3 — guest tracking_code**: cerrar el hueco de seguridad del guest consumer.
4. **Fase 4 — nuevos eventos**: signals e integraciones para `inventario`, `menu`, `resenas`, `clientes`, `loyalty`.
5. **Fase 5 — limpieza**: eliminar consumers/hooks viejos, actualizar docs.
