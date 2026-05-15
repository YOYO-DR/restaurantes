# Auditoria Tecnica MVP - FoodHub (Plataforma de Restaurantes)

> Evaluacion completa del estado del proyecto como ingeniero de sistemas avanzado.
> Objetivo: convertir el proyecto en un MVP funcional y vendible como SaaS por suscripcion.

---

## 1. Resumen Ejecutivo

El proyecto tiene una **arquitectura solida y bien disenada**. La separacion backend/frontend, el sistema de permisos RBAC, el manejo de pedidos con WebSockets, y el soporte multi-tenant por restaurante estan bien implementados. Sin embargo, hay **brechas criticas** que impiden que sea un MVP vendible hoy. La mas importante: **no hay sistema de pagos real**.

### Puntaje por area (1-10)

| Area | Puntaje | Estado |
|---|---|---|
| Arquitectura backend | 8/10 | Solida, bien estructurada |
| Modelo de datos | 8/10 | Completo, bien indexado |
| Sistema de pedidos | 7/10 | Funcional pero sin pagos reales |
| Tiempo real (WebSockets) | 8/10 | Bien implementado |
| Frontend - UI/UX | 7/10 | Bonito pero incompleto en flujos |
| Frontend - Estado | 5/10 | Sin React Query, useReducer para todo |
| Testing | 4/10 | Cobertura muy baja (~15%) |
| Seguridad | 6/10 | RBAC bien, pero falta proteccion CSRF, rate limiting insuficiente |
| Documentacion | 3/10 | README basico, sin docs de API por endpoint |
| CI/CD | 0/10 | No existe pipeline |
| Monitoreo/Observabilidad | 2/10 | Solo Sentry en prod, sin health checks |
| Suscripcion/Pagos | 1/10 | Modelo existe, implementacion vacia |

---

## 2. Lo Que FUNCIONA Correctamente

### Backend
- Registro y login con JWT + refresh token rotativo + cookie httpOnly
- CRUD completo de restaurantes, menu, categorias, inventario
- Checkout para 3 modalidades: delivery, pickup, mesa
- Soporte para pedidos de invitados (guest) con codigo de rastreo
- WebSockets en tiempo real para notificar pedidos a duenos, clientes e invitados
- Sistema de roles RBAC (admin, restaurante, operador, cliente)
- Panel admin con metricas, reportes, graficos
- Permisos a nivel de objeto (owner solo ve sus restaurantes)
- Cancelacion de pedidos con motivo
- Historial de estados de pedidos
- Sistema de fidelizacion (loyalty) modelado
- Sistema de notificaciones modelado
- Soft delete en modelos base
- Docker Compose funcional con PostgreSQL, Redis, Celery, Flower

### Frontend
- UI moderna con shadcn/ui + Tailwind v4 + dark mode
- Navegacion por roles (admin, cliente, dueno)
- Pagina publica de restaurante con menu visual
- Carrito de compras con persistencia en contexto
- Checkout con formulario para invitados y autenticados
- Dashboard de dueno con pedidos en tiempo real (WebSocket)
- Gestion de menu con imagenes (CRUD completo)
- Gestion de inventario
- Pagina de seguimiento de pedidos para invitados (mis-pedidos)
- Panel admin con graficos (Recharts)
- Sistema de temas (light/dark)

---

## 3. Lo Que NO FUNCIONA o NO ESTA CONECTADO

### Critico (Bloquea MVP)

1. **NO HAY PASARELA DE PAGOS REAL**
   - El modelo `OrderPaymentTransaction` existe pero nunca se crea ni se usa en el checkout
   - No hay integracion con Stripe, MercadoPago, PayU, Wompi, ni ninguna pasarela
   - El flujo actual crea la orden sin cobrar. Tecnicamente es "gratis para siempre"
   - Esto es **bloqueante absoluto** para un MVP vendible

2. **NO HAY SISTEMA DE SUSCRIPCION FUNCIONAL**
   - Existe el modelo `SubscriptionPlan` con precio y periodo de facturacion
   - Existe `BillingPeriod`
   - Pero no hay logica de cobro recurrente, no hay webhooks, no hay manejo de trials, no hay downgrade/upgrade
   - El registro de dueno no asigna un plan ni valida pagos

3. **NO HAY ONBOARDING DE RESTAURANTE**
   - Cuando un dueno se registra, se crea un restaurante vacio con defaults
   - Pero no hay un wizard/post-registro que guie al dueno a: configurar menu, horarios, direccion, metodos de pago, branding
   - El dueno llega a un dashboard vacio sin orientacion

4. **EL FRONTEND NO TIENE PAGINACION REAL EN LISTAS LARGAS**
   - `restaurantes.jsx` carga todos los restaurantes de una vez (sin paginacion)
   - `mis-pedidos.jsx` lista sin paginacion
   - `favoritos.jsx` idem
   - Solo admin/users y admin/restaurants tienen filtros de paginacion

### Importante (Funcional pero con bugs/problemas)

5. **INVENTARIO NO SE DESCUENTA AUTOMATICAMENTE**
   - Al crear un pedido, los `MenuItemIngredient` vinculan items del menu con inventario
   - Pero el checkout **nunca descuenta** el inventario (`InventoryStockMovement`)
   - Las cantidades de `current_stock` nunca se actualizan automaticamente

6. **LOYALTY NO SE CONECTA A PEDIDOS**
   - El modelo `LoyaltyAccount` existe, pero **nunca se crea al registrar un cliente**
   - Los puntos nunca se acumulan al completar pedidos
   - Las recompensas (`LoyaltyReward`) no se pueden canjear desde el frontend

7. **NOTIFICACIONES PUSH/EMAIL NO FUNCIONAN**
   - El modelo `NotificationEvent` guarda eventos en BD
   - Pero no hay consumers de notificaciones, no hay envio real de push, no hay email de notificacion
   - Solo existe `send_order_confirmation_email` para email transaccional

8. **PERSONALIZACION VISUAL DEL RESTAURANTE PARCIAL**
   - El backend soporta colores, logos, layout, etc. (`RestaurantBranding`)
   - El frontend captura colores via CSS variables
   - Pero el logo y cover personalizados no se muestran (se usa placeholder generico)
   - Los archivos subidos (logo_file, cover_file) no tienen endpoint de serving

9. **OPERADOR (ROL) NO TIENE ACCESO EN EL FRONTEND**
   - El backend tiene el modelo `Operador` y permisos para operadores
   - Pero el frontend no tiene login como operador ni dashboard de operador
   - El `OwnerOrdersContext` solo verifica owner/admin

10. **NO HAY BUSQUEDA/FILTROS EN EL MENU PUBLICO**
    - La pagina de restaurante muestra todas las categorias y items
    - No hay barra de busqueda, no hay filtro por tags, no hay ordenamiento
    - Con 50+ items se vuelve inusable

### Menor (Mejoras de calidad)

11. **EL FRONTEND NO USA REACT QUERY / TANSTACK QUERY**
    - Todos los hooks usan `useState` + `useEffect` manualmente
    - No hay cache, no hay revalidacion automatica, no hay deduplicacion de requests
    - Cada navegacion entre paginas del dashboard dispara multiples requests innecesarios
    - No hay manejo de loading states consistente, no hay retry

12. **NO HAY VALIDACION DE SLUG UNICOS EN EL FRONTEND**
    - Al crear menu items/categorias, el frontend genera slugs con `buildSlug()` local
    - Si hay duplicados, el backend falla con 400 generico sin mensaje claro

13. **HARDCODED STRINGS EN ESPANOL POR TODO EL CODIGO**
    - No hay i18n real (aunque hay locale/ con es, fr, pt-br en backend)
    - Los textos de UI, errores, toasts estan todos en espanol hardcodeados

14. **NO HAY SKELETONS PARA TODOS LOS ESTADOS DE CARGA**
    - Algunas paginas muestran "Cargando..." generico en vez de skeletons

15. **EL HEADER DEL SITIO PUBLICO TIENE LINKS A PAGINAS VACIAS**
    - `/servicios` y `/precios` tienen contenido estatico placeholder
    - "Recuperar contrasena" no tiene endpoint en el backend

---

## 4. Problemas de Seguridad

### Críticos

1. **Checkout sin limite de items ni validacion de monto maximo**
   - Un atacante puede crear pedidos con 1000 items sin restriccion

2. **Rate limiting solo en checkout (15/h auth, 5/h guest)**
   - No hay rate limiting en login (fuerza bruta posible)
   - No hay rate limiting en registro (spam de cuentas)
   - No hay rate limiting en endpoints publicos de restaurantes

3. **Cancelacion de pedido por guest sin verificacion adicional**
   - Cualquiera con el ID del pedido puede cancelarlo via PATCH
   - Para guest se requiere solo conocer el ID (UUID, pero predecible si se expone)

### Importantes

4. **No hay confirmacion de email al registrarse**
   - El usuario se crea directamente como activo (`is_active=True`)
   - El `RegisterSerializer` en `backend/apps/custom_auth/api/serializers.py:66` crea el usuario sin enviar verificacion

5. **No hay proteccion contra CSRF en API externa**
   - Aunque se usa JWT, los endpoints AllowAny (checkout, guest tracking) no tienen CSRF protection adicional

6. **Password reset no implementado**
   - La pagina `/recuperar-contrasena` existe en el frontend pero no tiene endpoint en el backend

---

## 5. Deuda Tecnica

### Backend

1. **`apps/orders/services.py:188-198`** - `build_order_code` definida pero no usada (el serializador tiene su propia logica duplicada en `CheckoutSerializer.create`)
2. **Validaciones repetidas** - El `CheckoutSerializer.validate` tiene 170 lineas con mucha logica de negocio que deberia estar en servicios
3. **Consultas N+1 potenciales** - Aunque se usa `select_related` y `prefetch_related`, `OrderSerializer.get_cancel_reason` hace una subquery que no esta optimizada con prefetch
4. **Migraciones en orden fragil** - Las migraciones dependen de fechas de creacion, no hay migraciones de datos (data migrations)

### Frontend

5. **El hook `useOwnerMenu` carga categorias + items anidados** pero el endpoint no usa paginacion - potencial problema con menus grandes (>200 items)
6. **`useOwnerRestaurantMenu` (hook)** - El estado local duplica la data del servidor sin estrategia de sincronizacion clara
7. **Componentes de 900+ lineas** - `menu.jsx` (958 lineas) tiene 2 componentes de dialogo internos que deberian extraerse
8. **Manejo de errores inconsistente** - Algunos hooks capturan errores con estado, otros solo hacen `console.error`

---

## 6. Arquitectura Actual vs Deseada para SaaS

### Lo que tienes (bien):
- Multi-tenant por restaurante (owner_id)
- Roles RBAC
- Personalizacion por restaurante (branding)
- WebSockets por restaurante/usuario

### Lo que falta para ser SaaS:

```
PRIORIDAD 1 - Para cobrar:
  - Integracion de pasarela de pagos (Stripe/MercadoPago)
  - Sistema de suscripcion con planes (Free trial 14 dias, Basic, Pro)
  - Webhooks de pagos (activacion, cancelacion, renovacion)
  - Limitar features por plan (ej: Pro tiene analiticas avanzadas, QR)

PRIORIDAD 2 - Para retener:
  - Onboarding wizard post-registro
  - Email transaccionales completos (bienvenida, pedido nuevo, factura)
  - Dashboard con metricas relevantes desde dia 1
  - Soporte in-app (chat/FAQ)

PRIORIDAD 3 - Para escalar:
  - API publica documentada con Swagger/OpenAPI
  - Webhooks para que restaurantes integren sus sistemas
  - Exportacion de datos (CSV/PDF)
  - Multi-idioma real (i18n con lazy loading)
```

---

## 7. Plan de Accion para MVP Vendible

### Fase 1 - Hacerlo Cobrable (1-2 semanas)

| Tarea | Prioridad | Esfuerzo |
|---|---|---|
| Integrar Stripe/MercadoPago para pagos en checkout | CRITICA | 3 dias |
| Implementar flujo de suscripcion (elegir plan al registrar dueno) | CRITICA | 3 dias |
| Crear webhook de Stripe para activar/desactivar suscripciones | CRITICA | 2 dias |
| Limitar features por plan (ej: solo Pro puede tener QR) | CRITICA | 1 dia |
| Agregar `is_active` check por suscripcion vencida | CRITICA | 1 dia |

### Fase 2 - Pulir la Experiencia (1-2 semanas)

| Tarea | Prioridad | Esfuerzo |
|---|---|---|
| Crear wizard de onboarding post-registro (4 pasos: info basica, horarios, menu inicial, personalizacion) | ALTA | 3 dias |
| Descontar inventario automaticamente al crear pedido | ALTA | 1 dia |
| Conectar loyalty: crear cuenta al registrar, sumar puntos al completar pedido | ALTA | 2 dias |
| Mostrar logo/cover personalizado del restaurante (servir archivos via API o CDN) | MEDIA | 1 dia |
| Agregar busqueda y filtros en el menu publico del restaurante | MEDIA | 2 dias |

### Fase 3 - Robustez y Seguridad (1 semana)

| Tarea | Prioridad | Esfuerzo |
|---|---|---|
| Email de verificacion al registrar (con token) | ALTA | 2 dias |
| Implementar password reset completo (frontend + backend) | ALTA | 2 dias |
| Rate limiting en login y register | ALTA | 1 dia |
| Confirmacion por email/token para cancelar pedido como guest | MEDIA | 1 dia |
| Limitar max items por pedido (ej: 50) | MEDIA | 30 min |

### Fase 4 - Calidad Tecnica (1-2 semanas)

| Tarea | Prioridad | Esfuerzo |
|---|---|---|
| Agregar React Query para todas las llamadas API | MEDIA | 3 dias |
| Paginacion en todas las listas del frontend (restaurantes, menu publico) | MEDIA | 2 dias |
| Escribir tests de integracion para el flujo completo de checkout | MEDIA | 2 dias |
| Agregar CI/CD con GitHub Actions (lint + test + build) | BAJA | 2 dias |
| Extraer `OrderPaymentTransaction` al checkout real | MEDIA | 1 dia |

---

## 8. Si Yo Tuviera una Tienda - Funcionalidades Clave

Como dueno de restaurante, esto es lo que MAS valoro:

### Imprescindible (debe estar en MVP)

1. **Recibir pedidos y que me avisen YA** -> WebSocket + sonido en dashboard (ya casi lo tienes, falta sonido de notificacion)
2. **Gestionar pedidos facilmente** -> Cambiar estados con 1 click, ver items claramente (ya funciona)
3. **Menu autogestionable** -> Poder subir/editar/desactivar platos yo mismo sin depender de un admin (ya funciona)
4. **Cobrar con tarjeta/efectivo/nequi** -> Integracion de pagos (NO funciona)
5. **QR en la mesa** -> Que el cliente escanee y pida desde la mesa (backend listo, frontend del QR no implementado como pagina publica)
6. **Ver mis numeros** -> Dashboard con ventas del dia, platos mas vendidos, ticket promedio (parcialmente funciona)

### Muy valioso (para retener)

7. **Fidelizacion** -> Que los clientes acumulen puntos y los puedan canjear (modelado, sin implementar)
8. **Resenas** -> Los clientes dejan reviews y yo puedo responder (parcialmente implementado)
9. **Pedidos programados** -> "Quiero esto para manana a las 12pm" (no existe)
10. **Compartir menu por WhatsApp** -> Link directo al menu digital (ya tienes la URL, falta boton de compartir)

### Diferenciador (para vender mas)

11. **Modo offline-friendly** -> Si el restaurante tiene mal internet, que el mesero pueda tomar pedidos y se sincronicen despues (no existe, complejo)
12. **Integracion con Rappi/iFood** -> Recibir pedidos de plataformas externas unificados en un solo panel (no existe)
13. **Facturacion electronica** -> Generar factura para pedidos con NIT (Colombia requiere facturacion electronica)
14. **Dashboard de mesero** -> App sencilla para que el mesero tome pedidos en mesa desde su celular (no existe)

---

## 9. Evaluacion por Componente

### Modelo de Datos (8/10)
- **Fortalezas:** Bien normalizado, UUIDs consistentes, indices estrategicos, soft delete, base models reutilizables
- **Debilidades:** Falta modelo de Factura/Invoice, los payment transactions no se usan, `MenuItemIngredient` esta modelado pero sin logica de consumo

### API REST (7/10)
- **Fortalezas:** Viewsets consistentes, serializers con validacion robusta, manejo de guest + authenticated, throttling en checkout
- **Debilidades:** No hay filtros DRF (django-filter), no hay paginacion configurada en la mayoria de viewsets, no hay documentacion OpenAPI expuesta, algunos endpoints de admin exponen demasiada data

### WebSockets (8/10)
- **Fortalezas:** Canales separados por owner/user/guest, autenticacion por query string, reconexion en frontend, notificaciones toast
- **Debilidades:** No hay heartbeat/ping, no hay reconexion con backoff exponencial, los mensajes no tienen ID para deduplicacion

### Frontend UI (7/10)
- **Fortalezas:** shadcn/ui completo, Tailwind v4, dark mode, responsive, componentes reutilizables
- **Debilidades:** Muchas paginas "placeholder" (servicios, precios, recuperar-contrasena), skeletons inconsistentes, no hay transiciones de pagina

### Frontend Estado (5/10)
- **Fortalezas:** Context API bien organizado, auth flow con refresh cookie, cart context simple
- **Debilidades:** Sin React Query, cada hook refetcha todo al actualizar, no hay estado optimista, no hay cache, WebSocket no actualiza UI reactivamente en todas partes

### Testing (4/10)
- **Fortalezas:** Hay tests unitarios para auth, orders, restaurants, usuarios
- **Debilidades:** Cobertura general ~15%, no hay tests E2E, no hay tests de integracion WebSocket, no hay tests del flujo de checkout, frontend solo tiene 4 archivos de test

---

## 10. Recomendaciones Tecnicas Especificas

### Backend

1. **`backend/apps/orders/api/serializers.py:199`** - Agregar creacion de `OrderPaymentTransaction` con estado "pending"
2. **`backend/apps/menu/services.py`** - Agregar `deduct_inventory_for_order(order)` que recorra `MenuItemIngredient` y cree `InventoryStockMovement` con tipo `stock_out`
3. **`backend/apps/loyalty/`** - Crear `services.py` con `create_loyalty_account_for_user(user)` y `award_points_for_order(order)`
4. **`backend/config/settings/base.py`** - Agregar `DEFAULT_PAGINATION_CLASS` y `PAGE_SIZE` en `REST_FRAMEWORK`
5. **`backend/config/api_router.py`** - Exponer `api/docs/` con drf-spectacular (ya instalado pero no expuesto publicamente)
6. **`backend/config/urls.py`** - Agregar `path("api/health/", health_check_view)` para monitoreo

### Frontend

7. **Instalar y configurar TanStack Query** - Reemplazar `useState` + `useEffect` en todos los hooks, empezando por `use-restaurants.js`
8. **Crear `services/payments.js`** - Centralizar llamadas a API de pagos (crear intent de pago, confirmar)
9. **Agregar `@tanstack/react-query-devtools`** en dev
10. **Extraer componentes de dialogo** de `menu.jsx` (958 lineas) a archivos separados
11. **Crear `hooks/use-debounce.js`** para busqueda en menu publico
12. **Agregar sonido de notificacion** en `useOwnerOrderNotifications` cuando llega un pedido nuevo
13. **Implementar pagina QR publica** - `/{slug}/mesa/{tableId}` que muestre el menu y permita pedir desde la mesa

### Infraestructura

14. **Crear `docker-compose.staging.yml`** para entorno de pruebas
15. **Agregar health checks** a todos los servicios Docker
16. **Crear `nginx.conf`** con rate limiting por IP y proteccion de assets estaticos

---

## 11. Metricas de Exito para MVP

Un MVP vendible debe cumplir:

- [ ] Un dueno se registra, elige plan, paga (o inicia trial)
- [ ] El dueno configura su restaurante (nombre, horarios, direccion) en <10 min
- [ ] El dueno crea su menu (categorias + items con fotos) en <30 min
- [ ] Un cliente busca el restaurante, ve el menu, agrega al carrito
- [ ] El cliente hace checkout (autenticado o invitado), **paga**, y recibe confirmacion
- [ ] El dueno recibe el pedido en tiempo real con sonido/notificacion
- [ ] El dueno cambia el estado del pedido (preparando -> listo -> entregado)
- [ ] El cliente ve el estado de su pedido actualizarse en tiempo real
- [ ] El dueno ve metricas basicas al final del dia (ventas, pedidos, plato mas vendido)
- [ ] El sistema de suscripcion renueva/cobra automaticamente

---

## 12. Conclusion

El proyecto tiene **excelente potencial**. La arquitectura es solida y mucho del trabajo pesado (modelos, permisos, WebSockets, UI) ya esta hecho. Las areas que necesitan atencion inmediata son:

1. **Pagos reales** (Stripe/MercadoPago) - Sin esto no hay negocio
2. **Suscripciones funcionales** - Sin esto no hay modelo SaaS
3. **Onboarding** - Sin esto los duenos abandonan en el primer uso
4. **Inventario y loyalty conectados** - Son features diferenciadores
5. **React Query en frontend** - La UX se degrada sin cache ni revalidacion

Con **2-3 semanas de trabajo enfocado** en estas areas, el proyecto puede pasar de "demo tecnico" a "MVP funcional y vendible".

---

*Auditoria generada el 7 de mayo de 2026.*
*Proyecto: FoodHub - Plataforma de Restaurantes*
