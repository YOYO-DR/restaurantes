# Restaurantes

Plataforma de restaurantes con backend en Django/DRF y frontend en React + Vite.

Incluye:

- autenticacion JWT con refresh por cookie
- checkout para usuarios autenticados e invitados
- pedidos a domicilio, pickup y mesa
- seguimiento de pedidos en tiempo real con Django Channels + Redis
- panel de restaurante para gestionar pedidos, clientes y menu

## Stack

- `backend/`: Django, Django REST Framework, Channels, Redis, PostgreSQL, Celery
- `frontend/`: React 19, Vite, pnpm, Tailwind v4
- tiempo real: WebSockets con Channels + Redis
- infraestructura local: Docker Compose

## Estructura

```text
backend/
  apps/
    accounts/
    custom_auth/
    customers/
    menu/
    notifications/
    orders/
    restaurants/
    users/
  config/
frontend/
README.md
```

## Flujos principales

### Clientes

- registro e inicio de sesion con JWT
- checkout autenticado
- checkout como invitado para pickup, delivery y mesa
- seguimiento de pedidos en tiempo real
- cancelacion de pedidos con motivo opcional

### Restaurantes

- recepcion de pedidos nuevos en tiempo real
- cambio de estados: `new`, `preparing`, `ready`, `delivered`, `cancelled`
- cancelacion de pedidos con motivo opcional
- contador en sidebar de pedidos sin finalizar

### Invitados

- pedidos sin iniciar sesion
- almacenamiento local de pedidos por 24 horas en el navegador
- seguimiento de pedidos desde `/mis-pedidos`

## Requisitos

- Docker + Docker Compose
- Node.js y `pnpm`

## Desarrollo local

### 1. Levantar backend

Desde `backend/`:

```bash
docker compose -f docker-compose.local.yml up -d --remove-orphans
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py migrate
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py check
```

### 2. Levantar frontend

Desde `frontend/`:

```bash
pnpm install
pnpm dev
```

## Regla importante para backend

Cualquier comando de backend debe ejecutarse con Docker Compose.

Prefijo obligatorio desde `backend/`:

```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django
```

Ejemplos:

```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py shell
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pre-commit run --all-files
```

## Comandos utiles

### Backend

```bash
docker compose -f docker-compose.local.yml up -d --remove-orphans
docker compose -f docker-compose.local.yml down
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py check
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py migrate
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django ruff check . --fix
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django ruff format .
```

### Frontend

```bash
pnpm dev
pnpm build
pnpm lint
pnpm test:run
```

## Pedidos y tiempo real

- los pedidos del restaurante se notifican por websocket al dueno
- los pedidos autenticados se notifican al usuario por su canal privado
- los pedidos invitados se notifican por un canal temporal ligado al `order.id`
- el frontend de invitados guarda pedidos en `localStorage` con expiracion de 24 horas

## Catalogos obligatorios

El app `orders` asegura automaticamente catalogos base via `post_migrate`:

- `OrderType`: `delivery`, `pickup`, `table`
- `OrderStatus`: `new`, `preparing`, `ready`, `delivered`, `cancelled`

Si necesitas forzarlos manualmente:

```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py shell -c "from apps.orders.init_scripts.catalogs import ensure_order_catalogs; ensure_order_catalogs()"
```

## Correo

Variables utiles para configurar envio de correos:

- `DJANGO_EMAIL_BACKEND`
- `DJANGO_DEFAULT_FROM_EMAIL`
- `DJANGO_SERVER_EMAIL`
- `DJANGO_EMAIL_SUBJECT_PREFIX`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS`
- `EMAIL_USE_SSL`

Ejemplo SMTP:

```env
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DJANGO_DEFAULT_FROM_EMAIL=FoodHub <no-reply@tudominio.com>
DJANGO_SERVER_EMAIL=server@tudominio.com
DJANGO_EMAIL_SUBJECT_PREFIX=[FoodHub] 
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=tu_correo@dominio.com
EMAIL_HOST_PASSWORD=tu_password_o_app_password
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
```

## Autenticacion

- API principal: JWT con refresh token por cookie `HttpOnly`
- refresh configurado para durar 24 horas
- autenticacion API centralizada en `backend/apps/custom_auth`
- `django-allauth` fue removido del proyecto

## Permisos y alcance

- permisos reutilizables viven en `backend/apps/core/permissions.py`
- `IsAuthenticatedUser` centraliza acceso autenticado basico para endpoints de cuenta, cliente y loyalty
- `IsOwnerOrAdminRole` permite acceso a recursos operativos de restaurante solo a duenos y admin
- `IsOwnerObjectOrAdminRole` protege objetos cuyo propietario directo vive en `owner_id`
- `IsOwnerOfRestaurantResourceOrAdminRole` protege recursos ligados a un restaurante y evita que un dueno vea o modifique recursos de otro restaurante

Roles usados por la API:

- `cliente`: puede operar solo sobre sus propios recursos, pedidos y favoritos
- `restaurante`: puede operar solo sobre recursos de restaurantes cuyo `owner` coincide con el usuario autenticado
- `admin`: puede atravesar restricciones de ownership en endpoints administrativos y operativos

Notas de seguridad:

- los querysets de vistas owner se filtran por `restaurant__owner=request.user` cuando el usuario no es `admin`
- los serializers de menu e inventario validan que el restaurante enviado pertenezca al usuario autenticado, salvo `admin`
- los websockets privados de pedidos validan identidad y ownership antes de aceptar la conexion
- los clientes autenticados no pueden consultar pedidos de otros usuarios y los duenos no pueden consultar paneles ni recursos de otros restaurantes

## Notas

- backend usa Python `3.13`
- frontend usa alias `@/` para `src`
- no se deben versionar secretos ni archivos `.env`
- si cambias settings del backend, recrea el contenedor `django`
