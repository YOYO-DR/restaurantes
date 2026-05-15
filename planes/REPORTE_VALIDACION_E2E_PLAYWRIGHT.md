# Reporte de validacion E2E + auditoria de datos dinamicos

## Estado general

- Contenedores backend levantados correctamente.
- Verificacion de Django OK (`manage.py check`).
- Migraciones al dia (`manage.py migrate`, sin cambios pendientes).
- Usuario superadmin tecnico creado.
- Datos semilla E2E creados (admin/dueno/cliente + restaurante + menu + pedidos + favoritos + lealtad).
- Suite Playwright ejecutada completa: **36/36 pruebas en verde**.

## Evidencia de ejecucion

- Backend:
  - `docker compose -f docker-compose.local.yml up -d --remove-orphans`
  - `docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py check`
  - `docker compose -f docker-compose.local.yml run --rm django python manage.py migrate`
  - `docker compose -f docker-compose.local.yml run --rm ... django python manage.py createsuperuser --noinput`
- Frontend E2E:
  - `pnpm test:e2e -- e2e/roles-and-backend-validation.test.js`
  - `pnpm test:e2e --grep "configuracion cliente persiste preferencias y metodos de pago"`
  - `pnpm test:e2e --grep "contador de notificaciones en header usa backend"`
  - `pnpm test:e2e`

## Cobertura implementada en Playwright

Archivo nuevo: `frontend/e2e/roles-and-backend-validation.test.js`.

Valida:

- permisos por rol y redirecciones,
- login por `cliente`, `dueno`, `admin`,
- consumo de endpoints backend por vista clave,
- persistencia de configuracion en:
  - dueno (`/dashboard/restaurante/configuracion`),
  - admin (`/dashboard/admin/configuracion`).

## Hallazgos de hardcode / desacople backend

### Hallazgo 1 (alto): configuracion de cliente hardcodeada

- Archivo: `frontend/src/pages/dashboard/cliente/configuracion.jsx`
- Evidencia:
  - estado local de notificaciones sin llamadas API,
  - metodos de pago mock (`VISA ****4532`, `MC ****8721`),
  - acciones sin integracion real (solo UI).
- Impacto: la pantalla no representa estado real del sistema.

### Hallazgo 2 (medio): contador de notificaciones hardcodeado

- Archivo: `frontend/src/components/dashboard/dashboard-header.jsx`
- Evidencia: badge fijo con valor `3`.
- Impacto: inconsistencia entre UI y backend.

### Hallazgo 3 (medio): perfil dueno muestra "Cuenta verificada" fija

- Archivo: `frontend/src/pages/dashboard/restaurante/perfil.jsx`
- Evidencia: badge estatico, sin validar estado desde backend.
- Impacto: posible informacion enganosa.

### Hallazgo 4 (bajo): acciones UI no implementadas

- Varias vistas tienen botones deshabilitados o placeholders (ej. llamar/repetir pedido, backup manual).
- Impacto: esperado parcialmente por alcance actual, pero conviene etiquetar "Proximamente" para claridad.

## Validacion de permisos (resultado)

- No autenticado en dashboard redirige a login: OK.
- Cliente bloqueado de admin/dueno: OK.
- Dueno bloqueado de admin: OK.
- Admin redirigido fuera de dashboard dueno: OK.

## Configuraciones validadas con persistencia

- Dueno: cambio de `Nombre del negocio` se guarda y se refleja en dashboard (via API de owner settings/dashboard): OK.
- Admin: cambio de `Nombre de la plataforma` se guarda y permanece tras recarga: OK.

## Observaciones de alcance

- No se incluyeron pruebas de pasarela de pagos (segun requerimiento).
- La logica principal de autenticacion, dashboards por rol, permisos y configuraciones principales queda validada en E2E.

## Ajustes aplicados durante la corrida

- Se corrigieron selectores ambiguos en Playwright para la fila de preferencia `SMS` y para la verificacion de metodos de pago repetidos.
- Se robustecio la validacion de persistencia en configuracion de cliente usando respuesta `PATCH` + recarga y verificacion de estado esperado.
- La validacion del badge de notificaciones en header ahora:
  - crea evento autenticado para admin,
  - recarga y espera consumo de `/api/notifications/center/`,
  - verifica incremento real del contador en lugar de depender de presencia fija del badge.
