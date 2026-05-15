# Plan de validacion E2E (Playwright)

## 1) Objetivo

Validar el flujo real (frontend + backend) por rol (`cliente`, `dueno/restaurante`, `admin`) para asegurar que:

- las vistas muestran datos provenientes del backend (sin datos hardcodeados en pantallas criticas),
- la autorizacion por rol se cumple,
- las pantallas de configuracion guardan cambios y esos cambios se aplican,
- el sistema funciona sin pasarela de pagos (scope actual).

## 2) Prerrequisitos y preparacion

1. Levantar contenedores backend con Docker Compose local.
2. Verificar salud Django con `manage.py check` dentro de contenedor.
3. Verificar esquema con `manage.py migrate` dentro de contenedor.
4. Crear `superadmin` tecnico para tareas de validacion.
5. Sembrar datos E2E minimos y deterministas para pruebas:
   - usuarios por rol,
   - restaurante del dueno,
   - menu,
   - pedidos,
   - direccion/favorito/lealtad del cliente.

## 3) Matriz de cuentas de prueba

- Admin: `admin.e2e@foodhub.local` / `E2EPass123!`
- Dueno: `dueno.e2e@foodhub.local` / `E2EPass123!`
- Cliente: `cliente.e2e@foodhub.local` / `E2EPass123!`
- Superadmin tecnico: `superadmin@foodhub.local` / `SuperAdmin123!`

## 4) Cobertura E2E por rol

### 4.1 Cliente

- Login exitoso y redireccion al dashboard de cliente.
- Dashboard consume datos backend (nombre usuario, pedidos recientes, favoritos, puntos).
- Vistas con datos backend:
  - `pedidos`,
  - `direcciones`,
  - `favoritos`,
  - `puntos`,
  - `perfil`.
- Validar restricciones:
  - cliente no accede a rutas de admin ni dueno.

### 4.2 Dueno de restaurante

- Login exitoso y redireccion al dashboard de restaurante.
- Dashboard consume datos backend (nombre restaurante, metricas, top productos).
- Vistas con datos backend:
  - `pedidos`,
  - `menu`,
  - `clientes`,
  - `analiticas`,
  - `resenas`,
  - `perfil`.
- Configuracion de restaurante:
  - cambiar `Nombre del negocio`,
  - guardar,
  - validar aplicacion del cambio en dashboard.
- Validar restricciones:
  - dueno no accede a rutas de admin.

### 4.3 Administrador

- Login exitoso y redireccion al dashboard admin.
- Dashboard consume datos backend (metricas, distribucion, top restaurantes, alertas).
- Vistas con datos backend:
  - `usuarios`,
  - `restaurantes`,
  - `reportes`,
  - `configuracion`.
- Configuracion admin:
  - cambiar datos en tab General,
  - guardar,
  - recargar,
  - validar persistencia.
- Validar restricciones:
  - admin no queda en vistas de cliente/dueno al navegar directo.

## 5) Pruebas de permisos cruzados

- No autenticado en `/dashboard/*` debe ir a `/login`.
- Cliente intentando `/dashboard/admin` y `/dashboard/restaurante` redirige a `/dashboard/cliente`.
- Dueno intentando `/dashboard/admin` redirige a `/dashboard/restaurante`.
- Admin intentando `/dashboard/restaurante` redirige a `/dashboard/admin`.

## 6) Verificacion de no-hardcode en frontend (previa a ejecucion E2E)

Auditar codigo de vistas para confirmar uso de hooks/servicios API y detectar contenido estatico no conectado.

## 7) Ejecucion automatizada

- Implementar suite Playwright con:
  - helpers de login por rol,
  - pruebas de permisos,
  - pruebas por rol,
  - pruebas de persistencia de configuracion.
- Ejecutar con `pnpm test:e2e`.

## 8) Evidencia y salida

- Reporte HTML de Playwright (`frontend/playwright-report/`).
- Reporte tecnico en Markdown con:
  - checks ejecutados,
  - pruebas que pasan/fallan,
  - hallazgos de hardcode,
  - recomendaciones priorizadas.

## 9) Estado de ejecucion

- [x] Plan documentado en Markdown.
- [x] Arranque de contenedores backend.
- [x] `manage.py check`.
- [x] `manage.py migrate`.
- [x] Creacion de superadmin tecnico.
- [x] Siembra de datos E2E base.
- [x] Implementacion suite E2E extendida.
- [x] Ejecucion de suite y reporte final de resultados.
