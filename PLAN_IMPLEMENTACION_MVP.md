# Plan de Implementacion - FoodHub MVP Vendible

> Plan detallado para convertir el proyecto en un MVP funcional y vendible como SaaS por suscripcion.
> Fecha: 7 de mayo de 2026

---

## Requisitos del Cliente (validados)

1. **Checkout sin pasarela externa** - Los pagos de pedidos los maneja el restaurante directamente (nequi, efectivo, transferencia). Se necesita un sistema de medios de pago configurables por el dueno.
2. **Fidelidad activable por dueno** - Cada restaurante decide si activa o no el programa de fidelidad. Por defecto inactivo.
3. **Pasarela de pagos solo para suscripciones** - MercadoPago (disponible en Colombia) para cobrar planes a los duenos. Con flujo de upgrade/downgrade bien manejado.
4. **3 planes de suscripcion** - Bien definidos segun el proyecto.
5. **Onboarding guiado** - Wizard post-registro para el dueno.

---

## Checklist Global de Validacion MVP

> Marcar items al completar cada fase. Este checklist se revisa antes de considerar el MVP "listo para produccion".

```
[ ] FASE 0 — Todo el codigo existente tiene pruebas pasando
[ ] FASE 1 — Planes creados, registro con selector de plan, limites por plan
[ ] FASE 2 — Dueno configura medios de pago, cliente los ve en checkout
[ ] FASE 3 — Dueno activa/desactiva fidelidad, cliente acumula puntos al completar pedido
[ ] FASE 4 — Dueno paga suscripcion con MercadoPago, upgrade/downgrade funciona
[ ] FASE 5 — Inventario se descuenta al crear pedido, devolucion con confirmacion al cancelar
[ ] FASE 6 — QR publica, busqueda en menu, paginacion, sonido notificaciones, reset password
[ ] FASE 7 — Rate limits, tests E2E con Playwright, CI/CD
```

---

## FASES DE IMPLEMENTACION

---

# FASE 0: Auditoria y Validacion del Codigo Existente

> Objetivo: Correr y pasar todas las pruebas existentes de backend y frontend antes de tocar una sola linea de codigo nuevo. Si algo falla, se arregla aqui. Esto garantiza que no rompemos nada al implementar las fases nuevas.

> Duracion: 2 dias

---

## 0.1 - Ejecutar Pruebas de Backend Existentes

Correr TODAS las pruebas del backend y verificar que pasen:

```bash
# Desde backend/
docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres \
  -e PGB_POSTGRES_PORT=5432 \
  django pytest -v
```

### Checklist de Backend (existente)

```
[ ] apps/users/tests/test_models.py        — Modelos de usuario (email como username)
[ ] apps/users/tests/test_managers.py      — UserManager (creacion por email)
[ ] apps/users/tests/test_forms.py         — Forms de admin
[ ] apps/users/tests/test_urls.py          — URLs de usuario
[ ] apps/users/tests/test_views.py         — Vistas tradicionales
[ ] apps/users/tests/api/test_views.py     — UserViewSet (API)
[ ] apps/users/tests/api/test_urls.py      — URLs de API de usuario
[ ] apps/users/tests/api/test_openapi.py   — Schema OpenAPI
[ ] apps/custom_auth/tests/test_api.py     — Register, Login, Refresh, Logout, Me
[ ] apps/custom_auth/tests/test_urls.py    — URLs de auth
[ ] apps/accounts/tests/test_api.py        — Account profile, admin dashboard/users/restaurants/reports/settings
[ ] apps/customers/tests/test_api.py       — Customer addresses, dashboard, favorites
[ ] apps/customers/tests/test_dashboard.py — Dashboard del cliente
[ ] apps/orders/tests/test_api.py          — Checkout, customer orders, owner orders
[ ] apps/orders/tests/test_websockets.py   — WebSocket consumers (owner, user, guest)
[ ] apps/restaurants/tests/test_api.py     — Public y owner restaurant views
[ ] apps/restaurants/tests/test_dashboard_metrics.py — Metricas del dashboard
[ ] apps/loyalty/tests/test_api.py         — Customer loyalty view
[ ] tests/test_merge_production_dotenvs_in_dotenv.py — Dotenv merge
```

### Acciones si alguna prueba falla:

1. Identificar el test fallido
2. Determinar si es bug de codigo o test desactualizado
3. Si es bug: arreglar el codigo
4. Si es test desactualizado: actualizar el test
5. Volver a correr hasta que todo pase

### Al final de 0.1:

```
[ ] pytest pasa con 0 errores
[ ] pytest pasa con 0 fallos
[ ] pytest --cov reporta cobertura >= 60%
```

---

## 0.2 - Ejecutar Pruebas de Frontend Existentes

Correr TODAS las pruebas del frontend:

```bash
# Desde frontend/
pnpm test:run
```

### Checklist de Frontend (existente)

```
[ ] src/components/auth/auth-forms.test.jsx          — Login y Register forms
[ ] src/components/auth/auth-session-provider.test.jsx — Session expiry redirect
[ ] src/components/restaurants/restaurant-menu.test.jsx — Componente de menu publico
[ ] src/context/auth-context.test.jsx                 — Auth context (login, logout, register)
```

### Acciones si alguna prueba falla:

1. Verificar que el mock de `api.js` este devolviendo la estructura esperada
2. Verificar que los componentes no hayan cambiado su API sin actualizar tests
3. Si es mock de API: actualizar el mock a la estructura actual de respuesta
4. Si es cambio de UI: actualizar los selectores/queries de testing-library

### Al final de 0.2:

```
[ ] pnpm test:run pasa con 0 errores
[ ] pnpm test:run pasa con 0 fallos
[ ] Verificar que todas las aserciones de testing-library siguen siendo validas
```

---

## 0.3 - Lint y Type Check del Backend

```bash
# Ruff lint
docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres \
  -e PGB_POSTGRES_PORT=5432 \
  django ruff check . --fix

# Ruff format
docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres \
  -e PGB_POSTGRES_PORT=5432 \
  django ruff format . --check

# Mypy
docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres \
  -e PGB_POSTGRES_PORT=5432 \
  django mypy .
```

### Checklist de Backend (lint)

```
[ ] ruff check . --fix — 0 errores
[ ] ruff format . --check — archivos ya formateados
[ ] mypy . — 0 errores (o solo errores conocidos y aceptables)
[ ] pre-commit run --all-files — todos los hooks pasan
```

---

## 0.4 - Lint y Build del Frontend

```bash
# Desde frontend/
pnpm lint
pnpm build
```

### Checklist de Frontend (lint)

```
[ ] pnpm lint — 0 errores, 0 warnings
[ ] pnpm build — build exitoso sin errores
```

---

## 0.5 - Pruebas de Navegador con Playwright (Infraestructura Base)

> Instalar Playwright y crear una suite de smoke tests que verifiquen las rutas principales.

```bash
# Desde frontend/
pnpm add -D @playwright/test
npx playwright install chromium
```

Crear archivo `frontend/playwright.config.js`:

```javascript
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
})
```

Crear archivo `frontend/e2e/smoke.test.js`:

```javascript
import { test, expect } from "@playwright/test"

test.describe("Smoke tests - Rutas publicas", () => {
  test("home page carga correctamente", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("header")).toBeVisible()
    await expect(page.locator("footer")).toBeVisible()
  })

  test("login page es accesible", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { name: /iniciar/i })).toBeVisible()
    await expect(page.getByLabel(/correo/i)).toBeVisible()
    await expect(page.getByLabel(/contrasena/i)).toBeVisible()
  })

  test("registro page es accesible", async ({ page }) => {
    await page.goto("/registro")
    await expect(page.getByRole("heading", { name: /crear/i })).toBeVisible()
    await expect(page.getByLabel(/nombre/i).first()).toBeVisible()
    await expect(page.getByLabel(/correo/i)).toBeVisible()
    await expect(page.getByLabel(/contrasena/i).first()).toBeVisible()
  })

  test("restaurantes page lista restaurantes", async ({ page }) => {
    await page.goto("/restaurantes")
    await expect(page.getByRole("heading", { name: /restaurantes/i })).toBeVisible()
  })

  test("navegacion desde home a restaurantes funciona", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: /restaurantes/i }).first().click()
    await expect(page).toHaveURL(/\/restaurantes/)
  })

  test("pagina 404 muestra contenido", async ({ page }) => {
    await page.goto("/ruta-que-no-existe")
    await expect(page.getByText(/404|no encontrad|pagina/i)).toBeVisible()
  })
})

test.describe("Smoke tests - Responsive", () => {
  test("home page es responsive en mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")
    await expect(page.locator("header")).toBeVisible()
  })

  test("menu mobile se abre en pantalla chica", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/")
    // Buscar boton de hamburguesa
    const menuButton = page.locator("header button").first()
    if (await menuButton.isVisible()) {
      await menuButton.click()
    }
  })
})
```

Agregar al `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:report": "playwright show-report"
  }
}
```

### Checklist de Playwright (Fase 0)

```
[ ] playwright.config.js creado
[ ] e2e/smoke.test.js creado con pruebas de rutas publicas
[ ] npx playwright install chromium — completado
[ ] pnpm test:e2e — smoke tests pasan (requiere backend corriendo para las paginas que hacen fetch)
[ ] pnpm test:e2e --project=mobile-chrome — responsive tests pasan
```

---

## 0.6 - Verificacion de Integracion Backend-Frontend

> Verificar que los endpoints que el frontend consume funcionan correctamente.

### Endpoints criticos a verificar:

```
[ ] GET  /api/restaurants/                — Lista de restaurantes
[ ] GET  /api/restaurants/{slug}/         — Detalle de restaurante
[ ] GET  /api/restaurants/{slug}/menu/    — Menu del restaurante
[ ] POST /api/auth/register/             — Registro de usuario
[ ] POST /api/auth/login/                 — Login
[ ] GET  /api/auth/me/                    — Perfil autenticado
[ ] POST /api/checkout/orders/            — Crear pedido (auth + guest)
[ ] GET  /api/checkout/orders/guest/{code}/ — Tracking de pedido guest
[ ] GET  /api/customer/orders/            — Pedidos del cliente
[ ] GET  /api/owner/orders/               — Pedidos del dueno
[ ] GET  /api/admin/dashboard/            — Dashboard admin
```

Ejecutar con curl o via Swagger en `http://localhost:8000/api/docs/`.

### Al final de la Fase 0:

```
[ ] Todos los tests de backend pasan (pytest)
[ ] Todos los tests de frontend pasan (vitest)
[ ] Backend lint (ruff check + ruff format + mypy) limpio
[ ] Frontend lint (eslint) limpio
[ ] Frontend build exitoso
[ ] Smoke tests de Playwright pasan en chromium y mobile
[ ] Endpoints criticos responden correctamente
```

> Si todo pasa, se procede a la Fase 1 con confianza.
> Si algo falla, se corrige ANTES de empezar la Fase 1.

---

# FASE 1: Modelo de Suscripcion y Onboarding

> Objetivo: Que un dueno se registre, elija plan, configure su restaurante y empiece a usarlo.

> Duracion: 6 dias

---

## 1.1 - Redisenar Planes de Suscripcion

### Backend

**Archivo:** `backend/apps/platform_config/models.py`

Agregar campos al modelo `SubscriptionPlan`:
- `max_menu_items` (int) - Limite de items en el menu
- `max_categories` (int) - Limite de categorias
- `max_tables` (int) - Limite de mesas
- `analytics_enabled` (bool) - Tiene dashboard avanzado
- `qr_enabled` (bool) - Puede generar QR
- `loyalty_enabled` (bool) - Puede activar fidelidad
- `custom_branding_enabled` (bool) - Puede personalizar colores/logos
- `trial_days` (int) - Dias de prueba gratis **por plan**. Valor por defecto configurable globalmente.
- `features` (JSONField) - Lista de features en texto para mostrar en UI
- `mercado_pago_plan_id` (char) - ID del plan en MercadoPago (para production)
- `sort_order` (int) - Orden de visualizacion

**Los 3 planes:**

| Plan | Precio/mes | Menu Items | Categorias | Mesas | Analytics | QR | Loyalty | Branding |
|---|---|---|---|---|---|---|---|---|
| **Starter** | ~$29,900 COP | 30 | 5 | 5 | Basico | No | No | Colores basicos |
| **Pro** | ~$79,900 COP | 100 | 15 | 20 | Avanzado | Si | Si | Completo + logo |
| **Enterprise** | ~$149,900 COP | Ilimitado | Ilimitado | Ilimitado | Completo + exportaciones | Si | Si | Completo + dominio propio |

**Migracion:** Crear `0002_subscription_plan_features` para agregar los nuevos campos.

**Catalogos (post_migrate):**

Crear script `backend/apps/platform_config/init_scripts/plans.py`:

```python
def ensure_subscription_plans():
    monthly, _ = BillingPeriod.objects.get_or_create(code="monthly", defaults={"name": "Mensual"})
    annual, _ = BillingPeriod.objects.get_or_create(code="annual", defaults={"name": "Anual"})

    plans = [
        {
            "code": "starter",
            "name": "Starter",
            "billing_period": monthly,
            "price_amount": "29900",
            "currency_code": "COP",
            "max_menu_items": 30,
            "max_categories": 5,
            "max_tables": 5,
            "analytics_enabled": False,
            "qr_enabled": False,
            "loyalty_enabled": False,
            "custom_branding_enabled": False,
            "trial_days": 14,
            "sort_order": 1,
            "features": [
                "Hasta 30 items en menu",
                "5 categorias",
                "Pedidos delivery, pickup y mesa",
                "Dashboard basico",
                "Soporte por email",
            ],
        },
        {
            "code": "pro",
            "name": "Pro",
            "billing_period": monthly,
            "price_amount": "79900",
            "currency_code": "COP",
            "max_menu_items": 100,
            "max_categories": 15,
            "max_tables": 20,
            "analytics_enabled": True,
            "qr_enabled": True,
            "loyalty_enabled": True,
            "custom_branding_enabled": True,
            "trial_days": 14,
            "sort_order": 2,
            "features": [
                "Hasta 100 items en menu",
                "15 categorias",
                "Codigos QR para mesas",
                "Programa de fidelidad",
                "Dashboard avanzado con graficos",
                "Personalizacion de marca",
                "Soporte prioritario",
            ],
        },
        {
            "code": "enterprise",
            "name": "Enterprise",
            "billing_period": monthly,
            "price_amount": "149900",
            "currency_code": "COP",
            "max_menu_items": None,  # ilimitado
            "max_categories": None,
            "max_tables": None,
            "analytics_enabled": True,
            "qr_enabled": True,
            "loyalty_enabled": True,
            "custom_branding_enabled": True,
            "trial_days": 14,
            "sort_order": 3,
            "features": [
                "Menu ilimitado",
                "Mesas ilimitadas",
                "Exportacion de reportes",
                "Multiples operadores",
                "API de integracion",
                "Soporte dedicado 24/7",
            ],
        },
    ]
    for plan_data in plans:
        SubscriptionPlan.objects.get_or_create(
            code=plan_data["code"],
            defaults={k: v for k, v in plan_data.items() if k != "code"},
        )
```

Conectar via `post_migrate` en `apps.py`.

### Checklist de 1.1

```
[ ] Migracion ejecutada (nuevos campos en SubscriptionPlan)
[ ] post_migrate crea los 3 planes correctamente
[ ] GET /api/admin/settings/ retorna lista de planes con features
[ ] GET /api/plans/ (nuevo endpoint publico opcional) retorna planes para registro
```

---

### Trial Configurable desde el Superadmin

El superadmin debe poder cambiar la cantidad de dias de trial, tanto a nivel global como por plan.

**Modelo adicional en `platform_config`:**

```python
class PlatformTrialConfig(BaseModel):
    """
    Configuracion global del trial.
    Se crea un solo registro (singleton) desde el admin.
    Si existe, sus dias de trial sobreescriben los `trial_days` de cada plan.
    """
    platform_name = models.CharField(max_length=140, default="Trial Config")
    trial_days_override = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text="Si se define, sobreescribe los trial_days de todos los planes. Dejar vacio para usar el valor por plan."
    )
    is_trial_enabled = models.BooleanField(default=True)

    class Meta:
        db_table = "platform_trial_config"

    def get_effective_trial_days(self, plan=None):
        """Retorna los dias de trial efectivos: override global > plan especifico > default 14"""
        if self.trial_days_override is not None:
            return self.trial_days_override
        if plan and plan.trial_days:
            return plan.trial_days
        return 14

    def save(self, *args, **kwargs):
        self.pk = PlatformTrialConfig.objects.first().pk if PlatformTrialConfig.objects.exists() else None
        super().save(*args, **kwargs)
```

**Endpoint admin para configurar trial:**

Agregar a `AdminSettingsViewSet` (ya existe en `apps/accounts/api/views.py`):
- Campo `trial_days` en el serializer de admin settings (lectura/escritura)
- Campo `is_trial_enabled` toggle
- Internamente persiste en `PlatformTrialConfig`

**Frontend - Panel Admin (configuracion):**

En `frontend/src/pages/dashboard/admin/configuracion.jsx`:
- Seccion "Configuracion de periodo de prueba"
- Campo numerico: "Dias de prueba" (dejar vacio = usar valor del plan)
- Toggle: "Periodo de prueba habilitado"
- Nota: "Si se define un valor aqui, sobreescribe los dias de prueba de todos los planes."

### Checklist de Trial Configurable

```
[ ] Modelo PlatformTrialConfig creado y migrado
[ ] AdminSettingsViewSet expone trial_days_override e is_trial_enabled
[ ] GET /api/admin/settings/ retorna campos de trial
[ ] PATCH /api/admin/settings/ actualiza trial_days_override
[ ] ensure_owner_restaurant usa get_effective_trial_days()
```

---

## 1.2 - Modificar Registro para Elegir Plan

### Backend

**Archivo:** `backend/apps/custom_auth/api/serializers.py`

En `RegisterSerializer`:
- Agregar campo `subscription_plan_code` (opcional, default "starter")
- Si `user_type` es "dueno", validar que el plan exista
- Al crear el restaurante en `ensure_owner_restaurant`, pasar el plan seleccionado (no hardcodear "starter")
- El restaurante se crea con `status = "trial"` (nuevo codigo en `RestaurantStatus`)

**Archivo:** `backend/apps/restaurants/services.py`

Modificar `ensure_owner_restaurant`:
- Aceptar parametro `subscription_plan_code`
- Crear restaurante con `trial_ends_at = now() + timedelta(days=plan.trial_days)`
- Si no se pasa plan, usar "starter" como fallback

Agregar al modelo `Restaurant`:
```python
trial_ends_at = models.DateTimeField(null=True, blank=True)
subscription_active = models.BooleanField(default=True)
subscription_ends_at = models.DateTimeField(null=True, blank=True)
mercado_pago_subscription_id = models.CharField(max_length=255, blank=True)
```

### Frontend

**Archivo:** `frontend/src/components/auth/register-form.jsx`

Modificar el formulario:
- Cuando `userType === "dueno"`, mostrar selector de plan (3 cards con nombre, precio, features)
- El campo de plan solo aparece DESPUES de los campos de restaurante (nombre, direccion)
- Mostrar "14 dias de prueba gratis" en cada plan
- Enviar `subscription_plan_code` en el payload

### Checklist de 1.2

```
[ ] RegisterSerializer acepta subscription_plan_code
[ ] Registro de dueno con plan "pro" crea restaurante con plan "pro"
[ ] Registro de dueno sin plan usa "starter" por defecto
[ ] Restaurante creado con trial_ends_at = now + trial_days
[ ] Frontend: selector de plan visible al elegir "dueno"
[ ] Frontend: cards de planes muestran nombre, precio, features
[ ] Frontend: "14 dias de prueba gratis" visible en cada card
```

---

## 1.3 - Check de Limites por Plan

### Backend

**Archivo:** `backend/apps/menu/api/views.py`

En `OwnerMenuCategoryViewSet` y `OwnerMenuCrudItemViewSet`:
- En `create`, verificar que no exceda `plan.max_categories` / `plan.max_menu_items`
- Si `max_menu_items` es None, no hay limite (Enterprise)

**Archivo:** `backend/apps/restaurants/api/views.py`

En `OwnerRestaurantViewSet` para mesas y QR:
- Verificar `plan.max_tables` al crear mesas
- Verificar `plan.qr_enabled` al crear QR
- Verificar `plan.loyalty_enabled` para activar fidelidad

### Frontend

Mostrar contadores en el UI:
- "5/30 items usados" en la pagina de menu para plan Starter
- Ocultar pestana de QR si el plan no lo permite
- Ocultar pestana de fidelidad si el plan no lo permite

### Checklist de 1.3

```
[ ] Crear categoria falla si excede max_categories del plan
[ ] Crear item de menu falla si excede max_menu_items del plan
[ ] Crear mesa falla si excede max_tables del plan
[ ] Crear QR falla si plan.qr_enabled = False
[ ] Activar loyalty falla si plan.loyalty_enabled = False
[ ] Plan Enterprise (limites None) permite crear ilimitado
[ ] Frontend muestra contadores de uso
[ ] Frontend oculta pestanas no permitidas por plan
```

---

## 1.4 - Onboarding Wizard Post-Registro

### Frontend

Crear nueva pagina `frontend/src/pages/onboarding.jsx` con un wizard de pasos:

**Paso 1: Informacion basica**
- Nombre legal del restaurante (pre-llenado con el del registro)
- NIT (opcional)
- Email de contacto (pre-llenado)
- Telefono
- Categoria (comida rapida, gourmet, cafeteria, etc.)

**Paso 2: Horarios**
- Grid de 7 dias con toggle "Cerrado" / "Abierto"
- Selector de hora apertura y cierre por dia
- Boton "Copiar horario a todos los dias"

**Paso 3: Menu inicial**
- Campo para crear primera categoria
- Campo para crear primeros 3 items (nombre y precio, lo basico)
- "Puedes agregar mas despues"

**Paso 4: Personalizacion rapida**
- Selector de color primario (5 opciones predefinidas)
- Subir logo (opcional, con preview)
- "O puedes hacerlo despues en Configuracion"

**Paso 5: Suscripcion (solo si no eligio en registro)**
- Mostrar los 3 planes con comparacion lado a lado
- Badge "Plan actual" en el seleccionado
- Boton "Iniciar prueba gratis de 14 dias" o "Empezar ahora"
- Si no hay pasarela aun, se activa trial automatico

**Al finalizar:** Redirigir a `/dashboard/restaurante` con un toast de bienvenida y un banner temporal "Completa tu perfil" hasta que todos los pasos esten hechos.

### Backend

Crear endpoint `POST /api/owner/restaurants/{id}/complete_onboarding/`:
- Recibe todos los datos del wizard
- Actualiza restaurante, horarios, crea primera categoria/items si se enviaron

El endpoint `GET /api/owner/restaurants/{id}/dashboard/` debe incluir un campo `onboarding_completed: bool` para que el frontend sepa si redirigir al wizard.

### Checklist de 1.4

```
[ ] Pagina /onboarding accesible solo para duenos autenticados
[ ] Paso 1: carga datos pre-llenados del registro
[ ] Paso 2: grid de 7 dias con toggle cerrado/abierto funciona
[ ] Paso 2: boton "Copiar a todos los dias" funciona
[ ] Paso 3: crea categoria + 3 items iniciales
[ ] Paso 4: selector de color guarda branding
[ ] Paso 5: comparacion de planes lado a lado
[ ] POST complete_onboarding/ guarda todos los datos
[ ] GET dashboard/ retorna onboarding_completed
[ ] Si onboarding_completed = false, redirige a /onboarding
[ ] Toast de bienvenida al finalizar
```

---

## Tests de la Fase 1

### Backend (pytest)

```python
# backend/apps/platform_config/tests/test_plans.py
class TestSubscriptionPlans:
    def test_planes_se_crean_en_post_migrate(self):
        """Los 3 planes existen despues de migrar"""
        ...

    def test_plan_starter_tiene_limites(self):
        """Starter limita a 30 items, 5 categorias, 5 mesas"""
        ...

    def test_plan_enterprise_no_tiene_limites(self):
        """Enterprise tiene limites en None"""
        ...

    def test_trial_config_override(self):
        """PlatformTrialConfig sobreescribe trial_days del plan"""
        ...

    def test_trial_config_sin_override_usa_plan(self):
        """Sin override, usa los trial_days del plan"""
        ...


# backend/apps/custom_auth/tests/test_register_with_plan.py
class TestRegisterWithPlan:
    def test_dueno_con_plan_pro(self):
        """Registro con subscription_plan_code='pro'"""
        ...

    def test_dueno_sin_plan_usa_starter(self):
        """Registro sin plan usa 'starter' por defecto"""
        ...

    def test_dueno_con_plan_inexistente_falla(self):
        """Plan que no existe retorna error de validacion"""
        ...


# backend/apps/menu/tests/test_plan_limits.py
class TestPlanLimits:
    def test_starter_no_puede_crear_mas_de_30_items(self):
        """Crear item 31 falla en plan Starter"""
        ...

    def test_enterprise_puede_crear_ilimitado(self):
        """Enterprise sin limite crea items sin restriccion"""
        ...

    def test_plan_sin_qr_no_puede_crear_qr(self):
        """Plan sin QR habilitado rechaza creacion"""
        ...
```

### Frontend (vitest)

```javascript
// frontend/src/components/auth/register-form.test.jsx (expandir)
describe("RegisterForm - selector de plan", () => {
  test("muestra planes al seleccionar dueno")
  test("oculta planes al seleccionar cliente")
  test("starter viene seleccionado por defecto")
  test("muestra '14 dias de prueba gratis' en cada plan")
  test("envia subscription_plan_code en el payload")
})

// frontend/src/pages/onboarding.test.jsx (nuevo)
describe("Onboarding wizard", () => {
  test("paso 1 muestra campos pre-llenados")
  test("paso 2 grid de horarios funciona con toggle")
  test("paso 2 boton copiar a todos funciona")
  test("paso 3 crea categoria y items")
  test("paso 4 selector de color guarda")
  test("paso 5 muestra comparacion de planes")
  test("al finalizar redirige a dashboard")
})
```

### Playwright (e2e)

```javascript
// frontend/e2e/register-flow.test.js
test.describe("Flujo de registro de dueno", () => {
  test("registro completo con seleccion de plan", async ({ page }) => {
    await page.goto("/registro")
    // Seleccionar tipo dueno
    await page.getByText("Dueno").click()
    // Llenar datos personales
    await page.getByLabel(/nombre/i).first().fill("Kevin")
    await page.getByLabel(/apellido/i).fill("Andre")
    await page.getByLabel(/correo/i).fill("test@foodhub.com")
    await page.getByLabel(/telefono/i).fill("3123456789")
    await page.getByLabel(/contrasena/i).first().fill("Test1234!")
    await page.getByLabel(/confirmar/i).fill("Test1234!")
    // Llenar restaurante
    await page.getByLabel(/restaurante/i).fill("El Buen Sabor Test")
    await page.getByLabel(/direccion/i).fill("Calle 123")
    // Seleccionar plan
    await page.getByText("Pro").click()
    // Aceptar terminos
    await page.getByLabel(/terminos/i).check()
    // Enviar
    await page.getByRole("button", { name: /crear cuenta/i }).click()
    // Debe redirigir al onboarding
    await expect(page).toHaveURL(/\/onboarding/)
  })
})

test.describe("Onboarding wizard", () => {
  test("completa los 5 pasos correctamente", async ({ page }) => {
    // Login previo como dueno con onboarding pendiente
    // ... (requiere setup de BD con estado conocido)
    await page.goto("/onboarding")
    // Paso 1
    await page.getByLabel(/nit/i).fill("123456789")
    await page.getByRole("button", { name: /siguiente/i }).click()
    // Paso 2
    await page.getByRole("button", { name: /copiar a todos/i }).click()
    await page.getByRole("button", { name: /siguiente/i }).click()
    // Paso 3
    await page.getByLabel(/categoria/i).fill("Platos Fuertes")
    await page.getByLabel(/nombre.*plato/i).first().fill("Hamburguesa")
    await page.getByLabel(/precio/i).first().fill("15000")
    await page.getByRole("button", { name: /siguiente/i }).click()
    // Paso 4
    await page.getByRole("button", { name: /empezar ahora/i }).click()
    // Debe redirigir al dashboard
    await expect(page).toHaveURL(/\/dashboard\/restaurante/)
    await expect(page.getByText(/bienvenido/i)).toBeVisible()
  })
})
```

### Checklist de Tests Fase 1

```
[ ] pytest apps/platform_config/tests/ — planes + trial config
[ ] pytest apps/custom_auth/tests/ — registro con plan
[ ] pytest apps/menu/tests/ — limites de plan
[ ] vitest: register-form.test.jsx — selector de plan
[ ] vitest: onboarding.test.jsx — wizard
[ ] playwright: e2e/register-flow.test.js — flujo completo registro
[ ] playwright: e2e/onboarding.test.js — wizard completo
```

---

# FASE 2: Sistema de Medios de Pago del Restaurante

> Objetivo: Que cada dueno configure sus medios de pago (nequi, efectivo, transferencia) con campos personalizados para que el cliente sepa como pagar.

> Duracion: 3 dias

---

## 2.1 - Modelo de Medios de Pago Configurables

### Backend

Crear modelos en `backend/apps/payments/models.py` (nueva app):

```python
# backend/apps/payments/models.py

class RestaurantPaymentMethod(BaseModel):
    """
    Medio de pago configurable por el dueno.
    Ej: Nequi con numero 123456, nombre "Kevin Andre", y comentario.
    """
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="custom_payment_methods",
    )
    method_type = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)
    instructions = models.TextField(blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "restaurant_payment_methods"


class PaymentMethodField(BaseModel):
    """
    Campos dinamicos de cada medio de pago.
    Ej: {label: "Numero de cuenta", value: "1234567890", field_type: "text"}
    """
    payment_method = models.ForeignKey(
        RestaurantPaymentMethod,
        on_delete=models.CASCADE,
        related_name="fields",
    )
    label = models.CharField(max_length=100)
    value = models.CharField(max_length=255)
    field_type = models.CharField(max_length=30, default="text")
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "payment_method_fields"
```

### Endpoints:

**`GET/POST /api/owner/restaurants/{id}/payment-methods/`**
- GET: Lista los metodos de pago del restaurante con sus campos
- POST: Crea un nuevo metodo con sus fields

**`PATCH/DELETE /api/owner/restaurants/{id}/payment-methods/{method_id}/`**
- PATCH: Actualiza campos de un metodo
- DELETE: Elimina un metodo

**`GET /api/restaurants/{slug}/payment-methods/`** (publico)
- Retorna los metodos de pago activos del restaurante (sin IDs internos)

### Frontend

Nueva pestana "Metodos de pago" en dashboard del dueno (`/dashboard/restaurante/pagos`):
- Lista de metodos existentes con toggle activo/inactivo
- Boton "Agregar metodo" -> Dialogo con:
  - Selector de tipo (Nequi, Daviplata, Bancolombia, Efectivo, Transferencia, Otro)
  - Campos dinamicos: boton "Agregar campo" que agrega fila (label, value)
  - Campo de instrucciones adicionales (textarea)
  - Boton guardar

---

## 2.2 - Mostrar Medios de Pago en Checkout

### Frontend

Modificar `frontend/src/pages/checkout.jsx`:

Agregar seccion "Como pagar" que:
- Carga `GET /api/restaurants/{slug}/payment-methods/`
- Muestra cada metodo como card con icono y campos configurados
- Muestra las instrucciones del dueno
- NO recolecta datos de pago del cliente

La seccion se muestra DESPUES del resumen y ANTES del boton "Confirmar pedido".

### Checklist de Fase 2

```
[ ] Modelos RestaurantPaymentMethod y PaymentMethodField migrados
[ ] POST /api/owner/restaurants/{id}/payment-methods/ crea metodo con campos
[ ] GET /api/restaurants/{slug}/payment-methods/ retorna metodos activos
[ ] PATCH actualiza campos de un metodo
[ ] DELETE elimina metodo y sus campos en cascada
[ ] Frontend dueno: lista, crea, edita, elimina metodos de pago
[ ] Frontend dueno: toggle activo/inactivo funciona
[ ] Frontend checkout: seccion "Como pagar" visible
[ ] Frontend checkout: muestra metodos activos con sus campos
```

### Tests de Fase 2

```
[ ] pytest apps/payments/tests/test_api.py — CRUD de metodos de pago
[ ] pytest apps/payments/tests/test_public.py — endpoint publico retorna solo activos
[ ] vitest: pagos page — CRUD en UI
[ ] playwright: e2e/payment-methods.test.js — dueno configura metodos
[ ] playwright: e2e/checkout-payment.test.js — cliente ve metodos en checkout
```

---

# FASE 3: Fidelidad Activable por Dueno

> Objetivo: Cada restaurante decide si activa fidelidad. Por defecto inactivo.

> Duracion: 2 dias

---

## 3.1 - Activar/Desactivar Fidelidad

### Backend

Agregar al modelo `Restaurant`:
```python
loyalty_enabled = models.BooleanField(default=False)
loyalty_points_per_order = models.PositiveIntegerField(default=10)
```

Modificar `OwnerRestaurantViewSet.settings`:
- Agregar campos `loyalty_enabled`, `loyalty_points_per_order` al serializer
- Validar que si el plan no permite loyalty, no se pueda activar

### Frontend

En `configuracion.jsx` del dueno:
- Seccion "Programa de fidelidad"
- Toggle activar/desactivar
- Campo puntos por pedido (default 10)
- Si plan no lo permite: badge "Requiere plan Pro" + toggle deshabilitado

---

## 3.2 - Acumulacion de Puntos

### Backend

Crear `backend/apps/loyalty/services.py`:

```python
def ensure_loyalty_account(user):
    """Crea cuenta de fidelidad si no existe para el usuario."""

def award_points_for_order(order):
    """Suma puntos al cliente cuando pedido se marca como entregado."""
    if not order.restaurant.loyalty_enabled:
        return
    if not order.user:
        return  # guest no acumula
    account, _ = LoyaltyAccount.objects.get_or_create(
        user=order.user,
        defaults={"tier": LoyaltyTier.objects.get(code="base")},
    )
    points = order.restaurant.loyalty_points_per_order
    account.current_points += points
    account.lifetime_points += points
    account.save()
    LoyaltyTransaction.objects.create(
        loyalty_account=account,
        order=order,
        tx_type=LoyaltyTransactionType.objects.get(code="earn"),
        points_delta=points,
        description=f"Puntos por pedido {order.order_code}",
    )
```

Conectar `award_points_for_order` en `OwnerOrderViewSet.status` cuando cambia a `delivered`.

### Checklist de Fase 3

```
[ ] Restaurant.loyalty_enabled migrado (default False)
[ ] Toggle activar/desactivar desde frontend dueno
[ ] Validacion: plan sin loyalty no puede activarlo
[ ] award_points_for_order se ejecuta al marcar delivered
[ ] Puntos se suman a LoyaltyAccount del cliente
[ ] LoyaltyTransaction se crea correctamente
[ ] Guest no recibe puntos
[ ] Si loyalty_enabled=False, no se suman puntos
```

### Tests de Fase 3

```
[ ] pytest apps/loyalty/tests/test_services.py — award_points, ensure_account
[ ] pytest apps/loyalty/tests/test_activation.py — validacion de plan
[ ] vitest: settings page — toggle loyalty
[ ] playwright: e2e/loyalty-flow.test.js — activar + comprar + ver puntos
```

---

# FASE 4: Pasarela de Pagos para Suscripciones (MercadoPago)

> Objetivo: Cobrar suscripciones a duenos via MercadoPago con flujo completo de upgrade/downgrade.
> MercadoPago se usa porque Stripe no esta disponible para particulares/empresas en Colombia.
> MercadoPago soporta: tarjetas de credito/debito, PSE, Efecty, Nequi, Daviplata.

> Duracion: 3 dias

---

## 4.1 - Integracion MercadoPago Backend

### Backend

Instalar `mercadopago` (SDK oficial: `pip install mercadopago`).

Crear `backend/apps/billing/` (nueva app):

```
billing/
  models.py       # MercadoPagoCustomer, BillingSubscription, PaymentEvent
  services.py     # create_preference, handle_webhook
  api/views.py    # Endpoints de billing
  api/serializers.py
  webhooks.py     # Procesar notificaciones IPN
  urls.py
```

**Vars de entorno:**
```env
MERCADOPAGO_ACCESS_TOKEN=APP_USR-xxxxxxxxxxxxx
MERCADOPAGO_PUBLIC_KEY=APP_USR-xxxxxxxxxxxxx
MERCADOPAGO_WEBHOOK_SECRET=xxxxxxxx
```

**Modelos principales:**

```python
class BillingSubscription(BaseModel):
    restaurant = models.OneToOneField(Restaurant, on_delete=models.CASCADE, related_name="billing_subscription")
    mercado_pago_subscription_id = models.CharField(max_length=255, unique=True)
    mercado_pago_preapproval_id = models.CharField(max_length=255, blank=True)
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    status = models.CharField(max_length=50)  # pending, authorized, active, cancelled, past_due
    current_period_start = models.DateTimeField(null=True)
    current_period_end = models.DateTimeField(null=True)
    cancel_at_period_end = models.BooleanField(default=False)

class PaymentEvent(BaseModel):
    subscription = models.ForeignKey(BillingSubscription, on_delete=models.CASCADE, related_name="payment_events")
    mercado_pago_payment_id = models.CharField(max_length=255)
    event_type = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    raw_data = models.JSONField(default=dict)
```

**Flujo de pago (Checkout Pro con auto_recurring):**

1. Dueno elige plan -> click "Suscribirse"
2. Frontend llama `POST /api/billing/create-subscription/`
3. Backend crea Preference en MP con `auto_recurring`
4. Frontend redirige a `init_point` (pagina de pago de MP)
5. MP maneja pago y redirige a success/pending/failure URL
6. Webhook IPN notifica eventos de suscripcion y pagos

**Endpoints:**

- `POST /api/billing/create-subscription/` — Inicia suscripcion (recibe plan_code, back_urls)
- `GET /api/billing/subscription/` — Estado actual
- `POST /api/billing/change-plan/` — Upgrade/downgrade
- `POST /api/billing/cancel-subscription/` — Cancelar al final del periodo
- `POST /api/billing/reactivate-subscription/` — Reactivar
- `POST /api/billing/webhook/` — Webhook IPN (verifica firma)
- `GET /api/billing/payment-history/` — Historial de pagos

**Servicio principal (`services.py`):**

Usa `mercadopago.SDK` para crear preferencias con `auto_recurring`.
El webhook procesa topicos `subscription` y `payment` actualizando BillingSubscription y Restaurant.

**Manejo de acceso:**
- Si `restaurant.subscription_active = False` y `subscription_ends_at < now()`:
  - Restaurante no aparece en busquedas publicas
  - Dashboard limitado a historial y configuracion
  - Banner "Activa tu suscripcion"

### Frontend

**Paginas de suscripcion:**
- `dashboard/restaurante/suscripcion` — Estado actual + cambiar plan
- `dashboard/restaurante/suscripcion/success` — Pago exitoso
- `dashboard/restaurante/suscripcion/pending` — Pago en proceso
- `dashboard/restaurante/suscripcion/failure` — Pago rechazado

### Checklist de Fase 4

```
[ ] Modelos BillingSubscription y PaymentEvent migrados
[ ] POST create-subscription/ crea Preference en MP y retorna init_point
[ ] GET subscription/ retorna estado actual
[ ] POST change-plan/ cancela actual y actualiza plan local
[ ] POST cancel-subscription/ marca cancel_at_period_end
[ ] Webhook procesa subscription_authorized correctamente
[ ] Webhook procesa payment.approved correctamente
[ ] Webhook procesa payment.rejected correctamente
[ ] Suscripcion vencida: restaurante no aparece en busquedas
[ ] Suscripcion vencida: dashboard muestra banner
[ ] Frontend: pagina de suscripcion muestra plan actual
[ ] Frontend: success/pending/failure pages existen
[ ] MercadoPago sandbox configurado (TEST-xxxxx)
```

### Tests de Fase 4

```
[ ] pytest apps/billing/tests/test_create_subscription.py — mock MP SDK
[ ] pytest apps/billing/tests/test_webhook.py — mock de notificaciones IPN
[ ] pytest apps/billing/tests/test_change_plan.py — upgrade/downgrade
[ ] pytest apps/billing/tests/test_access_control.py — suscripcion vencida
[ ] vitest: suscripcion page — muestra estado
[ ] playwright: e2e/subscription-flow.test.js — (usa MP sandbox o mock)
```

---

# FASE 5: Logica de Inventario y Fidelidad Conectados

> Objetivo: Conectar lo que esta modelado pero no implementado.
> Inventario se descuenta al crear pedido. Si se cancela, el dueno decide si devolver.

> Duracion: 2 dias

---

## 5.1 - Descontar Inventario en Pedidos

### Backend

Crear `backend/apps/menu/services.py`:

```python
def deduct_inventory_for_order(order):
    movements = []
    for order_item in order.items.all():
        if not order_item.menu_item:
            continue
        ingredients = order_item.menu_item.ingredients.select_related("inventory_item")
        for ingredient in ingredients:
            qty = ingredient.quantity_required * order_item.quantity
            inv = ingredient.inventory_item
            inv.current_stock -= qty
            inv.save(update_fields=["current_stock", "updated_at"])
            movement = InventoryStockMovement.objects.create(
                inventory_item=inv,
                movement_type=InventoryMovementType.objects.get(code="stock_out"),
                quantity=-qty,
                reason=f"Pedido {order.order_code}",
                created_by=order.user,
            )
            movements.append(movement)
            if inv.current_stock <= inv.min_stock:
                notify_low_stock(inv)
    return movements
```

Llamar en `CheckoutSerializer.create()` despues de crear la orden.

---

## 5.2 - Devolucion de Inventario al Cancelar (Con Confirmacion)

### Backend

```python
def restore_inventory_for_order(order, restored_by):
    for order_item in order.items.all():
        if not order_item.menu_item:
            continue
        for ingredient in order_item.menu_item.ingredients.select_related("inventory_item"):
            qty = ingredient.quantity_required * order_item.quantity
            inv = ingredient.inventory_item
            inv.current_stock += qty
            inv.save(update_fields=["current_stock", "updated_at"])
            InventoryStockMovement.objects.create(
                inventory_item=inv,
                movement_type=InventoryMovementType.objects.get_or_create(
                    code="stock_restore", defaults={"name": "Devolucion por cancelacion"},
                )[0],
                quantity=+qty,
                reason=f"Cancelacion pedido {order.order_code}",
                created_by=restored_by,
            )
```

Endpoint `POST /api/owner/orders/{id}/cancel-with-inventory/`:
- Recibe `{restore_inventory: bool, reason: str}`
- Cancela pedido + opcionalmente devuelve inventario

`OrderCancelSerializer` se expande con campo `restore_inventory` (bool, default False).

`OrderSerializer.get_inventory_impact()` retorna ingredientes afectados para mostrar en UI.

### Frontend

Modificar `CancelOrderDialog`:
- Lista ingredientes afectados
- Radio: "Devolver al inventario" / "No devolver"
- Campo de motivo

### Checklist de Fase 5

```
[ ] deduct_inventory_for_order se llama al crear pedido
[ ] InventoryStockMovement con stock_out se crea
[ ] current_stock se reduce correctamente
[ ] restore_inventory_for_order devuelve stock correctamente
[ ] cancel-with-inventory con restore_inventory=true devuelve stock
[ ] cancel-with-inventory con restore_inventory=false no devuelve
[ ] OrderSerializer incluye inventory_impact
[ ] Frontend: CancelOrderDialog muestra ingredientes afectados
[ ] Frontend: radio "Devolver/No devolver" visible
```

### Tests de Fase 5

```
[ ] pytest apps/menu/tests/test_inventory_deduction.py — descuento al crear pedido
[ ] pytest apps/menu/tests/test_inventory_restore.py — devolucion al cancelar
[ ] pytest apps/menu/tests/test_inventory_no_restore.py — cancelar sin devolver
[ ] pytest apps/orders/tests/test_cancel_with_inventory.py — endpoint cancel-with-inventory
[ ] vitest: CancelOrderDialog — radio visible + lista ingredientes
[ ] playwright: e2e/inventory-flow.test.js — crear pedido -> ver stock -> cancelar -> preguntar devolucion
```

---

# FASE 6: Pulido General del Frontend

> Objetivo: Arreglar bugs, mejorar UX, completar lo que falta.

> Duracion: 3 dias

---

## 6.1 - Pagina QR Publica

Crear ruta `/{slug}/mesa/{tableId}`:
- Pagina simplificada solo menu + "Pedir en esta mesa"
- Sin header/footer del sitio, solo branding del restaurante
- Carrito se abre automaticamente

## 6.2 - Busqueda en Menu Publico

Barra de busqueda con debounce (300ms) en `RestaurantMenu`.

## 6.3 - Paginacion en Listas

Configurar `DEFAULT_PAGINATION_CLASS` en DRF `PAGE_SIZE=20`.
Agregar en `PublicRestaurantViewSet`, `CustomerOrderViewSet`, `OwnerOrderViewSet`, `FavoriteViewSet`.

## 6.4 - Sonido de Notificacion en Pedidos

Reproducir .mp3 cuando llega `owner.order.created` via WebSocket.

## 6.5 - Recuperar Contrasena

Endpoints `POST /api/auth/password-reset/` + `POST /api/auth/password-reset/confirm/`.
Frontend `recuperar-contrasena.jsx` con 2 pasos.

### Checklist de Fase 6

```
[ ] QR: /{slug}/mesa/{tableId} muestra menu
[ ] QR: pagina sin header publico, solo branding
[ ] Busqueda: input con debounce filtra items
[ ] Busqueda: contador de resultados
[ ] Paginacion: restaurantes, pedidos, favoritos usan paginacion
[ ] Sonido: nuevo pedido reproduce audio
[ ] Reset: POST password-reset/ envia email (en dev, log)
[ ] Reset: POST password-reset/confirm/ actualiza contrasena
[ ] Reset: frontend 2 pasos funciona
```

### Tests de Fase 6

```
[ ] pytest apps/custom_auth/tests/test_password_reset.py — reset flow
[ ] vitest: recuperar-contrasena.test.jsx — UI de 2 pasos
[ ] playwright: e2e/qr-table.test.js — escanea QR, pide en mesa
[ ] playwright: e2e/menu-search.test.js — busca item, filtra
[ ] playwright: e2e/password-reset.test.js — solicita reset, cambia password
```

---

# FASE 7: Calidad y Seguridad

> Objetivo: Dejar el proyecto listo para produccion.

> Duracion: 2 dias

---

## 7.1 - Seguridad Adicional

| Tarea | Archivo |
|---|---|
| Rate limiting en login (5/min por IP) | `config/settings/base.py` |
| Rate limiting en register (3/hora por IP) | `apps/custom_auth/api/views.py` |
| Validar max 50 items por pedido | `apps/orders/api/serializers.py` |
| Email de verificacion opcional al registrar | `apps/custom_auth/api/serializers.py` |

---

## 7.2 - Tests E2E con Playwright (Suite Completa)

Crear `frontend/e2e/` con estructura organizada:

```
frontend/e2e/
  smoke.test.js              — (Fase 0) Rutas publicas
  auth-flow.test.js          — Registro cliente + login + logout
  register-flow.test.js      — (Fase 1) Registro dueno con plan + onboarding
  onboarding.test.js         — (Fase 1) Wizard completo
  restaurant-browse.test.js  — Buscar restaurante, ver menu, agregar al carrito
  checkout-auth.test.js      — Checkout autenticado (delivery)
  checkout-guest.test.js     — Checkout invitado (delivery)
  checkout-table.test.js     — Checkout mesa
  payment-methods.test.js    — (Fase 2) Dueno configura metodos, cliente los ve
  owner-orders.test.js       — Dueno recibe pedido, cambia estados
  owner-menu.test.js         — Dueno CRUD de menu
  owner-settings.test.js     — Dueno configura restaurante
  loyalty-flow.test.js       — (Fase 3) Activar loyalty, comprar, ver puntos
  subscription-flow.test.js  — (Fase 4) Pagar suscripcion (mock MP)
  inventory-flow.test.js     — (Fase 5) Descuento + devolucion inventario
  qr-table.test.js           — (Fase 6) QR mesa, pedir desde QR
  menu-search.test.js        — (Fase 6) Busqueda en menu
  password-reset.test.js     — (Fase 6) Recuperar contrasena
  admin-flow.test.js         — Admin dashboard, users, reports
```

### Playwright con datos de prueba:

Usar setup global que cree datos via API antes de los tests:

```javascript
// frontend/e2e/setup.js
import { test as setup } from "@playwright/test"

setup("crear datos de prueba via API", async ({ request }) => {
  // Registrar dueno
  const registerRes = await request.post("http://localhost:8000/api/auth/register/", {
    data: {
      email: "test.dueno@foodhub.com",
      name: "Test Dueno",
      password: "Test1234!",
      password_confirm: "Test1234!",
      phone: "3123456789",
      user_type: "dueno",
      restaurant_name: "Restaurante Test E2E",
      restaurant_address: "Calle Test 123",
      subscription_plan_code: "pro",
    },
  })
  // Guardar tokens para tests
  const data = await registerRes.json()
  process.env.TEST_OWNER_ACCESS = data.access
  process.env.TEST_OWNER_USER = JSON.stringify(data.user)

  // Registrar cliente
  const clientRes = await request.post("http://localhost:8000/api/auth/register/", {
    data: {
      email: "test.cliente@foodhub.com",
      name: "Test Cliente",
      password: "Test1234!",
      password_confirm: "Test1234!",
      phone: "3123456780",
      user_type: "cliente",
    },
  })
  const clientData = await clientRes.json()
  process.env.TEST_CLIENT_ACCESS = clientData.access
})
```

---

## 7.3 - CI/CD

Crear `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: foodhub
          POSTGRES_PASSWORD: foodhub
          POSTGRES_DB: foodhub
        ports: ["5432:5432"]
      redis:
        image: redis:7.2
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.13" }
      - run: pip install -r backend/requirements/local.txt
      - run: |
          cd backend
          pytest --cov
          ruff check .
          ruff format . --check
          mypy .

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: "pnpm", cache-dependency-path: frontend/pnpm-lock.yaml }
      - run: cd frontend && pnpm install
      - run: cd frontend && pnpm lint
      - run: cd frontend && pnpm test:run
      - run: cd frontend && pnpm build

  e2e:
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: cd frontend && pnpm install
      - run: cd frontend && npx playwright install chromium --with-deps
      - run: cd frontend && npx playwright test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

### Checklist de Fase 7

```
[ ] Rate limiting login: 5/min devuelve 429
[ ] Rate limiting register: 3/hora devuelve 429
[ ] Max 50 items por pedido: checkout rechaza mas
[ ] Playwright: suite completa >= 15 tests E2E pasan
[ ] Playwright: tests corren en chromium + mobile-chrome
[ ] CI: backend pytest pasa en CI
[ ] CI: backend lint pasa en CI
[ ] CI: frontend lint + test:run + build pasan en CI
[ ] CI: playwright E2E pasan en CI
```

---

## Cronograma Final

| Fase | Dias | Entregable |
|---|---|---|
| **Fase 0** — Auditoria y validacion | 2 | Todo existente testeado y pasando |
| **Fase 1.1** — Redisenar planes | 1 | Planes con limites en BD |
| **Fase 1.2** — Registro con plan | 1 | Selector de plan en registro |
| **Fase 1.3** — Checks de limites | 1 | Validaciones de plan al crear |
| **Fase 1.4** — Onboarding wizard | 3 | Wizard 5 pasos + trial configurable |
| **Fase 2.1** — Medios de pago configurables | 2 | Modelo, endpoints, UI dueno |
| **Fase 2.2** — Mostrar en checkout | 1 | Seccion "Como pagar" en checkout |
| **Fase 3** — Fidelidad activable | 2 | Toggle + acumular puntos al entregar |
| **Fase 4** — Pasarela MercadoPago | 3 | Checkout, webhooks, upgrade/downgrade |
| **Fase 5** — Inventario + fidelidad | 2 | Descontar stock + devolucion con confirmacion |
| **Fase 6** — Pulido frontend | 3 | QR, busqueda, paginacion, sonido, reset pass |
| **Fase 7** — Calidad y seguridad | 2 | Rate limits, Playwright suite completa, CI |
| **TOTAL** | **23 dias** | MVP vendible completo |

---

## NOTAS IMPORTANTES

1. **MercadoPago en modo sandbox primero** - Usar credenciales de prueba (`TEST-xxxxx`). Los `mercado_pago_plan_id` se configuran desde admin de Django.

2. **El trial es configurable** - Superadmin puede cambiar dias de prueba desde panel admin (Settings). Si no se configura, usa 14 dias por defecto. Si se configura, sobreescribe el valor de todos los planes.

3. **Si no hay MercadoPago configurado aun** - El sistema funciona en modo "trial gratuito" para desarrollo. Flag `BILLING_ENABLED` en settings. Si False, todos los duenos entran en trial sin pagar.

4. **Los medios de pago son informativos** - No procesamos pagos de pedidos. Solo mostramos al cliente los datos de pago del restaurante.

5. **Devolucion de inventario con confirmacion** - Al cancelar pedido, el dueno/operador decide si ingredientes vuelven al inventario. No es automatico porque en la realidad pudieron ya haberse usado.

6. **El operador es un plus** - No es prioritario para MVP pero esta en plan Enterprise como "Multiples operadores".

7. **No eliminar funcionalidad existente** - Los cambios son aditivos. No se rompe nada de lo que ya funciona.

8. **MercadoPago Checkout Pro** - Redirige al usuario a la pagina de MP para pagar. Soportado en Colombia con: tarjetas, PSE, Efecty, Nequi, Daviplata. Ideal para el publico objetivo de pueblos colombianos.

---

*Plan generado el 7 de mayo de 2026.*
*Proyecto: FoodHub - Plataforma de Restaurantes*