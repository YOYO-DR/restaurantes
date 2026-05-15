# PLAN — Chat por pedido + botón Contactar (info del restaurante)

> **Estado:** Draft para validación
> **Fecha:** 2026-05-15
> **Owner:** Backend + Frontend
> **Alcance:** Activar el botón “Contactar” (modal con info del restaurante) y agregar un **Chat 1↔1 por pedido** (cliente ↔ restaurante) sobre WebSocket, con foto-attachments, ventana de vida atada al ciclo del pedido y borrado automático de archivos.

---

## 1. Resumen ejecutivo

Hoy el botón **“Contactar”** en `frontend/src/pages/dashboard/cliente/pedidos.jsx:233` está `disabled`. La feature consiste en:

1. **Botón “Contactar”** → abre un modal con la información del restaurante (nombre, teléfono, email, dirección, horarios). Es **read-only** y no requiere backend nuevo (reusa `Restaurant` + `RestaurantBranding`).
2. **Botón “Chat”** → abre un panel de chat **por pedido** sobre WebSocket. Reglas:
   - Solo visible y operable para el **dueño del pedido** (cliente autenticado **o** invitado validado por `guest_tracking_code`) y para el **restaurante** (dueño u operadores con permiso de lectura sobre módulo `pedidos`).
   - Permite mensajes de texto **y** envío de fotos (configurable globalmente por superadmin).
   - **Cierre automático:** 24h después de que el pedido entre en estado `delivered` o `cancelled`, el chat se marca como cerrado: las **imágenes se eliminan** del storage, los **mensajes de texto se conservan** como auditoría (con marca de `archivo eliminado`), y el WebSocket rechaza nuevas escrituras.
   - El restaurante puede ser **owner** o un **operador** (rol `operador` con permiso de lectura en módulo `pedidos`).

---

## 2. Decisiones tomadas (alineadas con el usuario)

| Decisión | Valor acordado |
|---|---|
| Pedidos invitados (sin cuenta) | Sí pueden chatear usando `guest_tracking_code` (reusa patrón `GuestOrderConsumer`). |
| Quién escribe desde el restaurante | Dueño (`restaurante`) **y** operadores con permiso de lectura en módulo `pedidos`. |
| Comportamiento al expirar (24h post-finalización) | Borrar **solo imágenes**; conservar mensajes de texto. |
| Límite tamaño imagen | 10 MB por defecto, **configurable por superadmin** en `PlatformSetting`. |
| Activar/desactivar envío de fotos | Toggle global en `PlatformSetting` (superadmin). |
| Por ahora solo imágenes | No se permiten otros archivos (audio, video, PDF) en este MVP. |

---

## 3. Modelo de datos (backend)

### 3.1 Nueva app `apps/order_chat`

Aislamos la feature de `apps/orders` para que el dominio de pedidos no crezca con responsabilidades de mensajería. Coloca:

```
backend/apps/order_chat/
  ├── apps.py
  ├── models.py
  ├── consumers.py
  ├── routing.py
  ├── permissions.py
  ├── services.py
  ├── tasks.py
  ├── signals.py
  ├── admin.py
  ├── migrations/
  ├── api/
  │   ├── serializers.py
  │   ├── views.py
  │   └── urls.py
  └── tests/
```

### 3.2 Modelos

```python
class OrderChat(BaseModel):
    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE, related_name="chat")
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    images_purged_at = models.DateTimeField(null=True, blank=True)

class OrderChatMessage(BaseModel):
    chat = models.ForeignKey(OrderChat, on_delete=models.CASCADE, related_name="messages")
    sender_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    sender_kind = models.CharField(max_length=20)  # "customer" | "restaurant" | "guest"
    sender_label = models.CharField(max_length=120, blank=True)  # nombre mostrado (snapshot)
    body = models.TextField(blank=True)            # texto opcional
    image = models.FileField(upload_to="order-chat/%Y/%m/", blank=True, null=True)
    image_purged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_by_customer_at = models.DateTimeField(null=True, blank=True)
    read_by_restaurant_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=("chat", "created_at"))]

    def clean(self):
        if not self.body and not self.image:
            raise ValidationError("El mensaje requiere texto o imagen.")
```

### 3.3 Settings configurables por superadmin

Extender `apps/platform_config/models.PlatformSetting`:

```python
chat_images_enabled = models.BooleanField(default=True)
chat_image_max_mb = models.PositiveIntegerField(default=10)
chat_image_allowed_mimes = models.CharField(
    max_length=255, default="image/jpeg,image/png,image/webp"
)
chat_post_close_purge_hours = models.PositiveIntegerField(default=24)
```

Expuesto en `admin.py` y en un endpoint público read-only para que frontend conozca los límites antes de subir.

---

## 4. API REST (HTTP)

### 4.1 Endpoints

| Método | Path | Auth | Propósito |
|---|---|---|---|
| `GET` | `/api/orders/<id>/contact-info/` | Cliente del pedido o guest con `?tracking_code=` | Info pública del restaurante (nombre, teléfono, email, dirección, horarios, logo). |
| `GET` | `/api/orders/<id>/chat/` | Cliente del pedido o guest o miembro del restaurante | Devuelve `OrderChat` + paginación de mensajes (cursor). |
| `POST` | `/api/orders/<id>/chat/messages/` | Igual | Crea un mensaje (texto y/o imagen, `multipart/form-data`). |
| `POST` | `/api/orders/<id>/chat/read/` | Igual | Marca mensajes como leídos para el lado que llama. |
| `GET` | `/api/platform/chat-config/` | Público | Devuelve límites/flags (max MB, mimes permitidos, fotos enabled). |

Las imágenes se suben **vía HTTP `multipart`**, no por el WebSocket (los WebSockets no son buenos para binarios grandes). El WebSocket se usa solo para notificar a la contraparte que llegó un mensaje nuevo y entregar el payload JSON ya persistido.

### 4.2 Permisos

Una sola permission class `OrderChatAccessPermission` que centraliza:

```
def has_object_permission(self, request, view, order):
    user = request.user
    if user.is_authenticated:
        if order.user_id == user.id:                      # cliente dueño
            return True
        if _is_restaurant_member(user, order.restaurant_id):  # owner o operador con read sobre pedidos
            return True
    # guest
    tracking = request.query_params.get("tracking_code") or request.data.get("tracking_code")
    if order.user_id is None and tracking and str(order.guest_tracking_code) == str(tracking):
        return True
    return False
```

`_is_restaurant_member` reutiliza `apps.core.permissions.is_owner_user` y `apps.restaurants.models.Operador` con filtrado por `operator_permissions` (módulo `pedidos`, acción `read`).

### 4.3 Reglas de negocio en el `POST /chat/messages/`

1. Si `order.chat.is_closed` → `403 chat_closed`.
2. Si `image` y `chat_images_enabled` es `False` → `400 images_disabled`.
3. Validación de imagen (server-side):
   - `request.FILES['image'].size <= chat_image_max_mb * 1024 * 1024` → si no, `413 image_too_large`.
   - MIME real verificado con `python-magic` (no confiar en `content_type` del navegador) ∈ `chat_image_allowed_mimes`.
   - Abrir con `Pillow.Image.open(...).verify()` para descartar polyglots.
   - Renombrar a `UUID4.ext` para evitar path traversal y leaks de nombre original.
4. Texto: `body` longitud ≤ 4000 chars; sanitizar (sin HTML).
5. Rate limit: 30 mensajes / 60s por usuario por chat (cache en Redis con `incr` + TTL).
6. Después de guardar → `broadcast_to_chat(order_chat_id, payload)` por canal layer.

---

## 5. WebSocket (Django Channels)

### 5.1 Routing

Nuevo en `apps/order_chat/routing.py`, registrado en `apps/notifications/routing.py`:

```python
re_path(
    r"api/ws/orders/(?P<order_id>[0-9a-f-]+)/chat/$",
    OrderChatConsumer.as_asgi(),
),
```

### 5.2 Consumer

`OrderChatConsumer(AsyncJsonWebsocketConsumer)`:

- `connect()`:
  1. Lee `order_id` del path y `tracking_code` / `access_token` del query string.
  2. `QueryStringJWTAuthMiddleware` ya resolvió `scope["user"]` si vino access_token.
  3. **Autoriza**: igual que `OrderChatAccessPermission` (replicado async via `database_sync_to_async`).
  4. Si el chat ya está cerrado (post 24h) → aceptar y mandar `{"type":"chat.closed"}`, luego cerrar (4003).
  5. Se une al group `order-chat-{order_id}`.
  6. Manda snapshot inicial: últimos 50 mensajes.
- `receive_json()`:
  - **No acepta enviar mensajes por WS.** Solo soporta `{"type":"ping"}` → `pong` y `{"type":"typing"}` → broadcast a la contraparte (sin persistir).
  - Esto evita atacar el WS para bypassear validaciones del POST HTTP (imágenes, rate limit) y simplifica el modelo de seguridad.
- `chat_event()` handler para recibir broadcasts del POST HTTP y reenviarlos a los clientes conectados.
- `disconnect()`: leave group.

### 5.3 Seguridad del WebSocket (puntos críticos)

| Riesgo | Mitigación |
|---|---|
| Inyección por path `order_id` | regex restringe a UUID hex; `database_sync_to_async` valida existencia y pertenencia. |
| Bypass de auth | Validación obligatoria en `connect()`: rechazar con códigos 4001 (no auth) y 4003 (no autorizado). Sin fallback anónimo. |
| Suplantación de guest | Comparar `guest_tracking_code` con UUID parseado correctamente (igual que `GuestOrderConsumer`); pedidos con `user` ≠ null no aceptan tracking_code. |
| Escritura tras cierre | Tanto el POST HTTP como el broadcast verifican `is_closed`. Connect rechaza si cerrado. |
| Cross-restaurant leak | `OrderChatAccessPermission` chequea `order.restaurant_id` contra membresía; el group key incluye `order_id` único. |
| Operador con sesión revocada | En el `chat_event`, antes de reenviar a un consumer de operador, reverificar `is_operator_session_active(user.id)` (patrón ya usado en `SessionNotificationsConsumer`) y cerrar con 4003 si fue revocado. |
| Mensajes desde el WS sin pasar por validación | `receive_json` **no** persiste; obliga a usar POST HTTP con permisos y rate limit completos. |
| DoS por flood | Rate limit en el POST HTTP + límite de tamaño de payload WS (`type=typing` ignorado tras 1/s por user). |
| Token expirado a mitad de conexión | Heartbeat cada 25s; cada N eventos revalidar `user.is_active` (patrón existente). Token expirado → cerrar 4001 para forzar reconexión con refresh. |
| Subida de archivos por WS | **Bloqueado por diseño**: WS no acepta binarios. Si llega un frame binario → cerrar con 4007. |
| CSRF en POST multipart | DRF + JWT en header `Authorization` o cookie con `SameSite=Lax` ya cubre. Validar `Origin` para el WS upgrade vía `CHANNELS_ALLOWED_HOSTS`/`AllowedHostsOriginValidator`. |

---

## 6. Tarea Celery: borrado automático de imágenes

### 6.1 Trigger

Dos vías complementarias, **una activa, una de defensa**:

1. **Programación al cerrar pedido (preferida):**
   - En `apps/orders/services.py`, cuando un pedido pasa a `delivered` o `cancelled`, agendar `purge_order_chat_images.apply_async(args=[order_id], eta=now + 24h)`.
   - Si vuelve a cambiar el status (re-apertura, caso raro), se cancela el `eta_task_id` guardado en `OrderChat`.

2. **Beat de respaldo (cada hora):**
   - `purge_expired_chat_images_beat` recorre `OrderChat` donde:
     - `order.status.code in ('delivered','cancelled')`
     - `order.status_history` última transición a esos estados > 24h
     - `images_purged_at is null`
   - Y dispara `purge_order_chat_images.delay(chat.order_id)`.

### 6.2 Implementación de `purge_order_chat_images`

```python
@shared_task
def purge_order_chat_images(order_id):
    chat = OrderChat.objects.select_related("order").get(order_id=order_id)
    cutoff_hours = PlatformSetting.objects.first().chat_post_close_purge_hours
    if not _is_eligible_for_purge(chat, cutoff_hours):
        return
    messages = chat.messages.filter(image__isnull=False).exclude(image="")
    for msg in messages:
        try:
            msg.image.delete(save=False)  # borra del storage
        except Exception:
            log.exception("purge failed", extra={"message_id": msg.id})
        msg.image_purged = True
        msg.image = None
        msg.save(update_fields=["image", "image_purged"])
    chat.is_closed = True
    chat.closed_at = timezone.now()
    chat.images_purged_at = timezone.now()
    chat.save(update_fields=["is_closed", "closed_at", "images_purged_at"])
    # Notifica a clientes conectados que el chat está cerrado
    async_to_sync(get_channel_layer().group_send)(
        f"order-chat-{order_id}",
        {"type": "chat_event", "event": {"event_type": "chat.closed", "payload": {}}},
    )
```

### 6.3 Registro en Beat

En la configuración de `django-celery-beat` (DB scheduler):
- Tarea `purge_expired_chat_images_beat` cada 1 hora.
- Documentar en `apps/order_chat/apps.py` `ready()` un seed idempotente (similar al patrón de catálogos de orders).

---

## 7. Frontend (React)

### 7.1 UI

En `pages/dashboard/cliente/pedidos.jsx`:

- Reemplazar el `<Button disabled>Contactar</Button>` por dos botones:
  - **Contactar** → abre `<RestaurantContactDialog order={order} />` (modal con info del restaurante).
  - **Chat** → abre un `<OrderChatSheet order={order} />` (panel lateral, estilo Shadcn `Sheet`).
- Mostrar **badge con conteo de no leídos** sobre el botón Chat usando el endpoint `GET /chat/` (campo `unread_count_for_me`).

Del lado restaurante, en la lista de pedidos del owner/operador (`pages/dashboard/restaurante/pedidos.jsx` — verificar nombre exacto), agregar el mismo `<OrderChatSheet>` y badge de no leídos.

### 7.2 Componentes nuevos

```
frontend/src/components/order-chat/
  ├── restaurant-contact-dialog.jsx      # info read-only del restaurante
  ├── order-chat-sheet.jsx               # contenedor del panel
  ├── order-chat-message-list.jsx        # lista virtualizada (react-virtuoso opt)
  ├── order-chat-composer.jsx            # textarea + botón adjuntar imagen
  └── order-chat-image-preview.jsx       # preview con tamaño y validación cliente
```

### 7.3 Hooks/servicios

```
frontend/src/hooks/use-order-chat.js     # gestiona WS + cache de mensajes
frontend/src/hooks/use-platform-chat-config.js  # lee /api/platform/chat-config/
frontend/src/services/order-chat.js      # apiJson wrappers para REST
```

`use-order-chat`:
- Abre WS a `wss://.../api/ws/orders/<id>/chat/?access_token=...` (o `?tracking_code=...` para guests).
- Reconexión exponencial (max 30s), heartbeat ping cada 25s.
- Carga histórico vía `GET /chat/` y luego entra al stream para mensajes nuevos.
- Envío de mensajes: SIEMPRE por `POST` HTTP (multipart si hay imagen). El WS notifica cuando la contraparte envía.

### 7.4 Validación cliente

Antes de subir imagen:
- Tipo en `allowed_mimes` (de `/api/platform/chat-config/`).
- Tamaño ≤ `chat_image_max_mb`.
- Si `chat_images_enabled=false`, el botón de adjuntar se deshabilita.
- Preview con `URL.createObjectURL`; revoke al desmontar.

---

## 8. Seguridad (resumen consolidado)

1. **Authn**: JWT en query string para WS (igual que el resto del sistema) + `tracking_code` UUID para guests.
2. **Authz**: `OrderChatAccessPermission` única source-of-truth, replicada async en el consumer.
3. **Cierre estricto**: pre-check en POST y broadcast; post-check en consumer; `is_closed` se setea atómicamente cuando se purgan imágenes.
4. **Uploads**:
   - Validación MIME real (`python-magic`).
   - Re-validación con Pillow (`.verify()`).
   - Renombrado UUID, `upload_to` con `%Y/%m`.
   - Tamaño y mime configurables por superadmin.
   - Toggle global para apagar fotos.
   - Headers `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` al servir.
5. **Rate limit** por usuario por chat (30/60s) — Redis `incr` con TTL.
6. **Mensajes binarios por WS prohibidos**; receive_json solo acepta `ping`/`typing`.
7. **AllowedHostsOriginValidator** en el ASGI app para evitar WS desde orígenes desconocidos.
8. **Borrado idempotente**: el task verifica `images_purged_at` antes de operar y captura excepciones por archivo individual para no perder la transacción completa.
9. **Auditoría**: cuando una imagen es purgada, queda `image_purged=True` y el mensaje conserva texto+timestamp+sender (compliance).
10. **Privacidad**: la URL pública de la imagen requiere autenticación o `tracking_code`; servida desde una vista DRF (`GET /chat/messages/<id>/image/`) que revalida permisos antes de devolver el archivo (evitar URLs públicas adivinables si MEDIA_ROOT estuviera expuesto).

---

## 9. Plan de implementación por fases

### Fase 0 — Reorganización (este PR)
- [x] Crear carpeta `planes/`.
- [x] Mover planes existentes a `planes/`.
- [x] Agregar este plan (`planes/PLAN_CHAT_PEDIDO.md`).

### Fase 1 — Backend: modelos + admin (1 PR)
- Crear app `apps/order_chat`.
- Modelos `OrderChat`, `OrderChatMessage`.
- Extender `PlatformSetting` con los campos de chat.
- Migraciones + signal `post_save` en `Order` que crea el `OrderChat` automáticamente al crear pedido.
- Admin Django (lectura + acción manual “forzar purge”).
- Tests: creación automática, ValidationError sin texto ni imagen, settings expuestos.

### Fase 2 — Backend: REST API + permisos (1 PR)
- `OrderChatAccessPermission` con tests para 4 roles (owner, operador-read, operador-sin-read, cliente, guest-válido, guest-inválido).
- Endpoints `GET /chat/`, `POST /chat/messages/`, `POST /chat/read/`, `GET /platform/chat-config/`, `GET /contact-info/`.
- Validación de imagen (size, mime real con magic, Pillow verify).
- Rate limit Redis.
- Vista para servir imagen con re-check de permisos.
- Tests integrados con `pytest-django`.

### Fase 3 — Backend: WebSocket (1 PR)
- `OrderChatConsumer` + routing.
- Origin validator a nivel ASGI.
- Broadcast desde el endpoint POST hacia el group.
- Tests con `channels.testing.WebsocketCommunicator`.

### Fase 4 — Backend: Celery purge (1 PR)
- Task `purge_order_chat_images`.
- Beat `purge_expired_chat_images_beat` cada hora.
- Programación con `eta` al transicionar pedido a `delivered`/`cancelled` (`apps/orders/services.py`).
- Tests con `freezegun`.

### Fase 5 — Frontend: modal Contactar (1 PR)
- `RestaurantContactDialog` consume `/contact-info/`.
- Habilitar el botón en `cliente/pedidos.jsx`.
- Tests Vitest.

### Fase 6 — Frontend: Chat (1 PR)
- Hook `use-order-chat`, `use-platform-chat-config`.
- Componentes en `components/order-chat/`.
- Integración en panel cliente y panel restaurante.
- Badge de no leídos.
- Tests Vitest + un E2E Playwright (cliente envía texto, restaurante responde, cliente sube foto).

### Fase 7 — QA y observabilidad (1 PR)
- Logs estructurados en consumer y task (`order_id`, `actor_role`).
- Métrica simple: contador de mensajes por hora (vía middleware o signal).
- Documentar en `README.md` o `AGENTS.md` el contrato del WS.

---

## 10. Riesgos y trade-offs

| Riesgo | Mitigación |
|---|---|
| Subida HTTP separada del WS rompe la sensación “tiempo real” | Mostrar el mensaje local optimistic-update; el WS confirma cuando broadcast llega. |
| Beat fallido deja imágenes huérfanas | Combinar `eta` (rápido) + beat (defensa); task idempotente con `images_purged_at`. |
| Operador pierde sesión a mitad de chat | Reverificación en cada `chat_event` (patrón existente). |
| Imagen gigante sobrecarga Pillow | Validar tamaño antes de Pillow; `Image.MAX_IMAGE_PIXELS` ajustado. |
| Cambio de `chat_post_close_purge_hours` durante un ciclo | El task lee siempre el setting actual; documentar que cambiar en caliente solo afecta nuevos pedidos. |
| Frontend en pestañas duplicadas | Hook detecta `visibilitychange` y pausa heartbeat en background, reanuda al volver. |

---

## 11. Métricas de éxito

- Tasa de mensajes enviados / pedido entregado.
- Tiempo de respuesta del restaurante (median first-response).
- 0 imágenes huérfanas tras 48h post-cierre (verificable con script).
- 0 conexiones WS no autenticadas aceptadas (test de regresión).

---

## 12. Preguntas abiertas (no bloqueantes; aclarar antes de Fase 5)

1. ¿El botón Chat debe ser visible siempre o solo cuando el pedido está en estados “activos” (no cancelled/delivered + 24h)?  → Propuesta: visible siempre que `chat.is_closed=false`; deshabilitado y con leyenda “Chat cerrado” cuando `true`.
Res: Si asi esta bien
2. ¿Notificaciones push (no solo WS) cuando un mensaje llega y el otro lado no está conectado? → Fuera de alcance MVP; reutilizable la app `notifications` después.
Res: Si, de una vez estaria bien
3. ¿Soporte multi-idioma para los mensajes del sistema (`chat.closed`)? → Usar `gettext_lazy` desde el inicio.
Res: Si, de una vez estaria bien

