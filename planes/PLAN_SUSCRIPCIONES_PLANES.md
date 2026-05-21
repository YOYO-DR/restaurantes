# Sistema de Suscripciones y Planes con Permisos Modulares

## Contexto

Hoy el proyecto tiene un `platform_config.SubscriptionPlan` que es solo un catálogo plano (código, nombre, precio). El campo `Restaurant.subscription_plan` apunta ahí pero **no controla nada**: no hay features asociadas al plan, no hay trial, no hay lifecycle, y las restricciones operativas se aplican únicamente vía `OperatorPermission` (que es per-empleado, no per-plan).

Se necesita un sistema completo de billing modular:

- **Catálogo de Features editable en BD** (con dependencias) que el admin pueda gestionar sin redeploys.
- **Planes con matriz Feature × (view/create/edit/delete)** — mismo modelo mental que `OperatorPermission`.
- **Trial gratuito configurable globalmente** + override individual por restaurante.
- **Lifecycle**: trial → active → cancelled (queda activo hasta fin del periodo) → downgrade automático a plan free.
- **Workflow de upgrade** vía solicitud que admin aprueba (diseñado para conectar pasarela en el futuro). **Cancelación** es directa (sin aprobación).
- **Overrides individuales** por restaurante (cortesía admin, no afecta el plan global).
- **Doble nivel de permisos**:
  - `can_view` sin permiso → ruta y sidebar item **ocultos**.
  - `can_create|edit|delete` sin permiso → vista accesible pero **botones bloqueados con candado** + tooltip.
- **Validación frontend + backend**: el frontend oculta/bloquea UI, el backend rechaza requests con 403.
- **JWT extendido**: `/api/auth/me/` devuelve `subscription.features` para que el frontend sepa qué mostrar sin endpoints extra.

El resultado es full-modular: el admin agrega features, define planes, ajusta trials y overrides desde el panel; el sistema se autorregula vía Celery.

---

## Arquitectura

### App nueva: `apps/billing/`

Nueva app dedicada (decisión del usuario, no extender `platform_config`). `SubscriptionPlan` se **migra** desde `platform_config` a `billing.Plan` con data migration preservando IDs por `code`.

### Modelos (9 nuevos)

```
Feature                      # catálogo de funcionalidades
  code (unique), name, category, description,
  is_active, sort_order
  Seed inicial: 11 features (menu, pedidos, inventario, clientes,
                lealtad, resenas, analiticas, qr, personalizacion,
                configuracion, operadores)

FeatureDependency            # grafo de dependencias entre features
  feature FK, depends_on FK
  unique(feature, depends_on); CHECK feature != depends_on
  Detección de ciclos al crear

Plan                         # planes de suscripción (migrado de SubscriptionPlan)
  code, name, description, billing_period FK,
  price_amount, currency_code,
  is_free, is_default, is_active, sort_order,
  metadata JSON (legacy_id para audit migración)

PlanFeature                  # matriz plan × feature × acción
  plan FK, feature FK,
  can_view, can_create, can_edit, can_delete
  unique(plan, feature)

TrialConfig                  # singleton de configuración global del trial
  is_enabled, default_trial_days, trial_plan FK

TrialFeatureDefault          # features por default del trial
  trial_config FK, feature FK,
  can_view, can_create, can_edit, can_delete

RestaurantSubscription       # 1:1 con Restaurant
  restaurant FK (OneToOne), plan FK,
  status (trial|active|cancelled|expired),
  trial_start, trial_end, override_trial_days,
  current_period_start, current_period_end,
  cancelled_at, scheduled_downgrade_to FK,
  auto_renew, payment_provider, provider_subscription_id,
  metadata JSON

RestaurantFeatureOverride    # overrides individuales por restaurante
  restaurant FK, feature FK,
  can_view, can_create, can_edit, can_delete,
  source (admin|trial), expires_at (nullable)
  unique(restaurant, feature)

PlanChangeRequest            # workflow approve/reject (solo upgrades/downgrades)
  restaurant FK, requested_plan FK, current_plan FK,
  request_type (upgrade|downgrade),
  status (pending|approved|rejected|superseded),
  requested_by, decided_by, decided_at, notes, metadata JSON

SubscriptionEvent            # audit log
  restaurant FK, event_type, old_plan FK, new_plan FK,
  actor FK, payload JSON, created_at
```

### Estructura de directorios

```
backend/apps/billing/
  apps.py, admin.py, models.py
  permissions.py              # PlanFeaturePermission + 11 subclases + combinador AND con OperatorModulePermission
  signals.py                  # post_save Restaurant → ensure RestaurantSubscription
  tasks.py                    # Celery: expire_trials, process_scheduled_downgrades
  init_scripts/
    catalogs.py               # ensure_billing_catalogs() llamado por post_migrate
    seed_features.py          # FEATURES_CATALOG con las 11 features
    seed_plans.py             # Plan FREE + plan trial default
  services/
    subscriptions.py          # start_trial, activate, cancel, expire_trial, downgrade_to_free
    features.py               # get_effective_features, check_feature_access, serialize_for_jwt
    dependencies.py           # validate_dependencies, expand_dependencies, detect_cycle
    requests.py               # create/approve/reject change requests
    events.py                 # audit log helpers
  api/
    serializers.py
    admin_views.py, admin_urls.py
    owner_views.py, owner_urls.py
  migrations/
    0001_initial.py
    0002_data_migrate_subscription_plans.py
    0003_create_default_subscriptions.py
  tests/                      # ver sección de tests
```

```
frontend/src/
  hooks/
    use-plan-feature.js              # { canView, canCreate, canEdit, canDelete, planCode, isLocked }
    use-billing.js                   # plans list, current subscription, change requests
    use-effective-permission.js      # AND(useOperatorPermission, usePlanFeature)
  services/
    billing.js
  components/
    auth/
      feature-gate.jsx               # oculta children si no tiene feature
      plan-protected-route.jsx       # redirige a /suscripcion si falta feature de vista
    ui/
      locked-action.jsx              # botón con candado + tooltip
    billing/
      plan-card.jsx, plan-features-matrix.jsx
      trial-banner.jsx, cancellation-banner.jsx
      change-plan-modal.jsx, subscription-status-badge.jsx
  pages/dashboard/
    admin/
      planes.jsx, planes-form.jsx    # CRUD planes + matriz features
      funcionalidades.jsx            # CRUD features + dependencias
      solicitudes.jsx                # approve/reject PlanChangeRequest
    restaurante/
      suscripcion.jsx                # owner: ver plan, solicitar cambio, cancelar
```

---

## Archivos a Modificar (existentes)

| Path | Cambio |
|---|---|
| `backend/config/settings/base.py` | Añadir `"apps.billing"` a `LOCAL_APPS`; `CELERY_BEAT_SCHEDULE` con `expire_trials_task` (horaria) y `process_scheduled_downgrades_task` (diaria 02:00) |
| `backend/config/api_router.py` | Registrar `AdminPlansViewSet`, `AdminFeaturesViewSet`, `AdminTrialConfigViewSet`, `AdminPlanChangeRequestViewSet`, `OwnerSubscriptionViewSet`, `OwnerPlanChangeRequestViewSet` |
| `backend/config/urls.py` | `include("apps.billing.api.admin_urls")` + `include("apps.billing.api.owner_urls")` |
| `backend/apps/restaurants/models.py` | `Restaurant.subscription_plan` FK pasa a apuntar a `"billing.Plan"` (vía AlterField) |
| `backend/apps/restaurants/services.py` | `_create_owner_restaurant` dispara `billing.services.subscriptions.start_trial(restaurant)` |
| `backend/apps/restaurants/tests/factories.py` | `SubscriptionPlanFactory` re-export desde `billing.tests.factories.PlanFactory` para no romper tests existentes |
| `backend/apps/platform_config/models.py` | Eliminar `SubscriptionPlan` (en migración separada `0003_remove_subscription_plan.py`, tras la data-migration) |
| `backend/apps/accounts/api/serializers.py` | `AdminRestaurantSerializer.subscription_plan` apunta a `billing.Plan.objects.filter(is_active=True)` |
| `backend/apps/accounts/api/views.py` | `AdminSettingsViewSet` lee planes desde `billing.Plan` para `catalogs.subscription_plans` |
| `backend/apps/custom_auth/api/serializers.py` | `UserMeSerializer` agrega `get_subscription()` que retorna `{plan, status, trial_end, current_period_end, cancelled_at, features:{...}}` para owners/operadores |
| `backend/apps/core/permissions.py` | Helper `effective_can(user, restaurant, feature_code, action)` que combina operator + plan |
| `backend/apps/menu/api/views.py`, `apps/orders/api/views.py`, `apps/loyalty/api/views.py`, `apps/customers/api/views.py`, `apps/restaurants/api/views.py` (reseñas, qr, personalizacion, configuracion) | Añadir `PlanFeaturePermission` correspondiente a `permission_classes` (combinada AND con la existente) |
| `frontend/src/App.jsx` | Wrappear rutas owner-specific con `<PlanProtectedRoute feature="...">` (menu, pedidos, lealtad, qr, etc.) |
| `frontend/src/components/dashboard/owner/owner-sidebar.jsx` | Agregar item "Mi Suscripción"; filtrar items por `subscription.features[module].can_view` además del `MODULE_MAP` actual |
| `frontend/src/components/dashboard/admin/admin-sidebar.jsx` | Agregar 3 items: "Planes", "Funcionalidades", "Solicitudes" |
| `frontend/src/layouts/owner-layout.jsx` | Montar `<TrialBanner/>` y `<CancellationBanner/>` antes del `<main>` |
| `frontend/src/context/auth-context.jsx` | Mapear `user.subscription` desde respuesta `/api/auth/me/` |
| `frontend/src/pages/dashboard/admin/restaurantes.jsx` | Tab/sección "Suscripción" en el modal de edición: ver plan actual, cambiar plan manual, extender trial, gestionar overrides |
| `frontend/src/pages/dashboard/admin/configuracion.jsx` | Nueva tab "Trial Gratuito" con `default_trial_days`, plan trial y matriz de `TrialFeatureDefault` |

---

## Reutilización de patrones existentes

| Funcionalidad | Reutilizar de |
|---|---|
| Permission class por módulo con HTTP→acción map | `apps/core/permissions.py::OperatorModulePermission` (líneas 130-162) — replicar para `PlanFeaturePermission` |
| Combinación de permission classes | Mismo patrón que `OperatorModulePermission` aplica a viewsets actuales |
| Matriz UI módulo × acción (checkboxes) | `frontend/src/pages/dashboard/restaurante/operadores.jsx` líneas 79-117 (`PermissionsMatrix`) — extraer a `frontend/src/components/billing/plan-features-matrix.jsx` |
| Seed catálogo vía post_migrate | `apps/orders/apps.py` líneas 1-26 + `apps/orders/init_scripts/catalogs.py` (mismo `dispatch_uid` pattern + `ensure_*()`) |
| Estructura ViewSet admin con `IsAdminRole` | `apps/accounts/api/views.py::AdminSettingsViewSet` líneas 839-908 |
| Factories pytest | `apps/restaurants/tests/factories.py` (pattern `factory.django.DjangoModelFactory`) |
| Fixture `api_client` + helper `assign_role` | `apps/orders/tests/test_api.py` líneas 26-37 |
| Hook con fallback admin/owner | `frontend/src/hooks/use-operator-permission.js` (replicar para `use-plan-feature.js`) |
| Banner global en layout | Patrón `frontend/src/layouts/owner-layout.jsx` (montar componente antes del `<main>`) |
| Empty state component | `frontend/src/components/ui/empty.jsx` (usar dentro de `LockedAction` o `PlanProtectedRoute` redirect) |
| Toasts | `sonner` (`import { toast } from "sonner"`) |
| API helper con retry 401 | `frontend/src/lib/api.js::apiJson` |

---

## Flujos clave

### 1. Lifecycle del trial
```
Registro nuevo owner
  → _create_owner_restaurant
    → billing.services.subscriptions.start_trial(restaurant)
        - TrialConfig.objects.singleton()  (id=1)
        - RestaurantSubscription(plan=trial_plan, status="trial",
            trial_start=now, trial_end=now + (override_days or default_days))
        - Aplica TrialFeatureDefault como RestaurantFeatureOverride(source="trial")
        - SubscriptionEvent(trial_started)
```

### 2. Expiración del trial (Celery beat horaria)
```
expire_trials_task
  → qs = subs filter(status="trial", trial_end__lt=now)
  → for sub in qs:
       downgrade_to_free(restaurant)
         - sub.plan = Plan(is_free=True)
         - sub.status = "active"
         - sub.current_period_end = None  (free no expira)
         - delete overrides source="trial"
         - SubscriptionEvent(trial_expired + subscription_downgraded)
```

### 3. Upgrade flow (con admin approval; preparado para pasarela)
```
Owner UI → POST /api/owner/restaurants/<id>/plan-change-requests/
  body: {requested_plan: "pro", notes: "..."}
  → services.requests.create_change_request
      - Valida no hay request pendiente (409 si lo hay)
      - Valida requested_plan != current_plan
      - Crea PlanChangeRequest(status="pending")
      - SubscriptionEvent(request_created)

Admin UI → POST /api/admin/plan-change-requests/<id>/approve/
  → services.requests.approve_request(req, admin_user) [select_for_update]
      - activate_subscription(restaurant, requested_plan)
          - sub.plan = requested_plan, status = "active"
          - current_period_start = now
          - current_period_end = now + billing_period.days
          - cancelled_at = None
      - req.status = "approved"
      - SubscriptionEvent(request_approved + plan_changed)
```

### 4. Cancel flow (directo, sin admin)
```
Owner UI → POST /api/owner/restaurants/<id>/subscription/cancel/
  → services.subscriptions.cancel_subscription(restaurant)
      - sub.cancelled_at = now
      - sub.scheduled_downgrade_to = Plan(is_free=True)
      - sub.auto_renew = False
      # sub.status sigue "active" hasta current_period_end
      - SubscriptionEvent(subscription_cancelled)

Celery beat diaria 02:00
  → process_scheduled_downgrades_task
      - qs = subs filter(cancelled_at__isnull=False, current_period_end__lt=now)
      - for sub in qs: downgrade_to_free(restaurant)
```

### 5. Validación de dependencias (al asignar features a plan)
```
PATCH /api/admin/plans/<id>/features/  {features: [{code, can_view,...}]}
  → services.dependencies.validate_dependencies(active_codes)
      - Para cada feature activa: todas sus deps deben estar activas
      - ValidationError("'lealtad' requiere 'clientes'") si falta
  → (opcional) services.dependencies.expand_dependencies(active_codes)
      - Retorna set ampliado con deps auto-incluidas (admin elige toggle)
  → guardar PlanFeature por cada uno

Creación de FeatureDependency:
  → services.dependencies.detect_cycle(feature, depends_on)
      - BFS desde depends_on; si llega a feature → ciclo → 400
```

### 6. JWT payload extendido
```
GET /api/auth/me/  → UserMeSerializer.get_subscription(obj)
  → restaurant_ids = get_user_owned_or_operated_restaurant_ids(obj)
  → if not restaurant_ids: return None  (clientes)
  → para owner: primer restaurante propio
  → para operador: su restaurante
  → sub = RestaurantSubscription.objects.select_related("plan")
            .prefetch_related("plan__plan_features__feature",
                              "restaurant__feature_overrides__feature")
            .get(restaurant_id=rid)
  → features = features_service.serialize_features_for_jwt(rid)
  → return {restaurant_id, plan, status, trial_end, current_period_end,
            cancelled_at, features: {<code>: {can_view, can_create, can_edit, can_delete}}}
```

---

## Migration Strategy (sin downtime)

1. **`apps/billing/0001_initial.py`** — crea 9 tablas vacías.
2. **`apps/billing/0002_data_migrate_subscription_plans.py`** — copia `platform_config.SubscriptionPlan` → `billing.Plan` por `code`, guarda `legacy_id` en `Plan.metadata`. Seedea Features (11), Plan FREE, TrialConfig.
3. **`apps/restaurants/0009_switch_subscription_plan_fk.py`** — `AlterField` de `Restaurant.subscription_plan` a apuntar a `billing.Plan`. Data migration previa actualiza FK numérica buscando Plan por `code`. Marca `run_before=[("billing","0002_...")]` o lo opuesto según orden.
4. **`apps/billing/0003_create_default_subscriptions.py`** — para cada Restaurant sin `RestaurantSubscription`, crea uno con `plan=restaurant.subscription_plan` y `status="active"` (o `"trial"` si aplica). Lee `OperatorPermission.can_view` actuales y crea `RestaurantFeatureOverride` espejo para preservar UX previo.
5. **`apps/platform_config/0003_remove_subscription_plan.py`** — `DeleteModel("SubscriptionPlan")`. **Solo en release siguiente** tras confirmar que no hay refs.

Rollback: 0002 es idempotente y no destructiva; la tabla legacy se mantiene 1 release.

---

## Inventario de funcionalidades administrables desde el panel admin

### A) Catálogo de Features — `/dashboard/admin/funcionalidades`
1. CRUD de Feature (code, name, category, description, is_active, sort_order)
2. Editor de dependencias por feature (multi-select con validación de ciclos)
3. Toggle global `is_active` (kill switch)

### B) Catálogo de Planes — `/dashboard/admin/planes`
4. CRUD de Plan (code, name, price, billing_period, is_free, is_default, is_active, sort_order)
5. Matriz Plan × Feature × (view/create/edit/delete) usando `PlanFeaturesMatrix`
6. Validar/auto-expandir dependencias antes de guardar

### C) Trial Global — `/dashboard/admin/configuracion` tab "Trial Gratuito"
7. Toggle trial habilitado
8. `default_trial_days`
9. Plan a aplicar como trial
10. Matriz de features incluidas en trial (`TrialFeatureDefault`)

### D) Suscripciones por Restaurante — `/dashboard/admin/restaurantes` → modal → tab "Suscripción"
11. Ver plan actual, status, trial_end, current_period_end
12. Cambiar plan manual (sin request, fuerza el cambio)
13. Extender trial individual (`override_trial_days`)
14. Resetear suscripción (forzar nuevo trial)
15. Agregar/quitar `RestaurantFeatureOverride` (cortesía), con `expires_at` opcional

### E) Solicitudes de Cambio — `/dashboard/admin/solicitudes`
16. Lista filtrable (pendientes/aprobadas/rechazadas/superseded)
17. Approve con notas
18. Reject con notas
19. Filtros: restaurante, plan, fecha, tipo

### F) Auditoría
20. Log paginado de `SubscriptionEvent` (en página dedicada o dentro de "Suscripciones")
21. Filtros: restaurante, event_type, actor, rango de fechas

---

## Frontend: jerarquía de permisos efectivos

El frontend resuelve `can_*` con la jerarquía:

```
useEffectivePermission(module) =
   AND(
     useOperatorPermission(module),    # ya existe; full-access para dueños
     usePlanFeature(module)            # nuevo; full-access para admin
   )
```

- **Ruta**: `<PlanProtectedRoute feature="lealtad" action="view">` → si falta `can_view`, redirige a `/dashboard/restaurante/suscripcion`.
- **Sidebar item**: oculto cuando `features[module].can_view === false`.
- **Botón create/edit/delete**: usar `<LockedAction>` cuando falta el permiso correspondiente:
  - Renderiza ícono `Lock` (lucide), tooltip "Mejora a Plan X para desbloquear", `aria-disabled=true`, click sin efecto.

---

## Test Plan

### Backend pytest (cobertura completa de casos no triviales)

**`test_models.py`**
- `feature_code_unique`
- `feature_dependency_no_self_loop` (CheckConstraint o full_clean)
- `feature_dependency_unique_pair`
- `plan_is_free_unique_among_active`
- `plan_is_default_unique`
- `plan_feature_unique_pair`
- `restaurant_subscription_one_to_one`
- `restaurant_feature_override_unique_pair`
- `subscription_status_choices_valid`
- `trial_config_singleton_enforced`

**`test_services_subscriptions.py`**
- `start_trial_creates_subscription_with_dates`
- `start_trial_applies_trial_feature_defaults_as_overrides`
- `start_trial_respects_override_trial_days`
- `start_trial_disabled_globally_creates_free_subscription`
- `activate_subscription_changes_plan_and_period`
- `activate_subscription_clears_cancelled_at`
- `cancel_subscription_marks_cancelled_at_keeps_active_until_period_end`
- `cancel_subscription_schedules_downgrade_to_free`
- `expire_trial_downgrades_to_free`
- `expire_trial_removes_trial_source_overrides`
- `downgrade_to_free_idempotent`
- `get_active_subscription_returns_current`

**`test_services_features.py`**
- `get_effective_features_returns_plan_features_when_no_overrides`
- `get_effective_features_override_supersedes_plan`
- `get_effective_features_inactive_feature_excluded`
- `get_effective_features_without_subscription_returns_empty`
- `check_feature_access_view_only`
- `check_feature_access_create_requires_can_view` (no can_view → niega create incluso si can_create=True)
- `check_feature_access_matrix_all_modules_all_actions` (parametrize 11×4 = 44 casos)
- `serialize_features_for_jwt_shape`

**`test_services_dependencies.py`**
- `validate_dependencies_passes_when_all_present`
- `validate_dependencies_fails_when_missing_dep`
- `validate_dependencies_chain_A_B_C`
- `expand_dependencies_includes_transitive_deps`
- `detect_cycle_self_loop`
- `detect_cycle_2_node`
- `detect_cycle_3_node`
- `dependencies_inactive_feature_ignored`

**`test_services_requests.py`**
- `create_change_request_owner_only`
- `create_change_request_rejects_duplicate_pending` (409)
- `create_change_request_rejects_same_plan`
- `approve_request_activates_plan_and_creates_event`
- `reject_request_marks_status_with_notes`
- `approve_request_concurrent_cancel_via_select_for_update`
- `request_superseded_when_admin_changes_plan_directly`

**`test_permissions.py`**
- `plan_feature_permission_view_blocked_without_can_view`
- `plan_feature_permission_post_blocked_without_can_create`
- `plan_feature_permission_put_blocked_without_can_edit`
- `plan_feature_permission_delete_blocked_without_can_delete`
- `override_supersedes_plan`
- `trial_expired_uses_free_plan_features`
- `combined_operator_and_plan_AND_logic` (4 combinaciones: O0P0, O0P1, O1P0, O1P1)
- `admin_bypasses_plan_check`
- `owner_without_subscription_returns_403`

**`test_api_admin.py`**
- `admin_plans_list_requires_admin_role`
- `admin_plans_create_with_features`
- `admin_plans_update_features_validates_dependencies`
- `admin_plans_delete_blocked_when_restaurants_assigned`
- `admin_features_crud`
- `admin_features_set_dependencies_endpoint`
- `admin_trial_config_get_returns_singleton`
- `admin_trial_config_patch_updates_default_days`
- `admin_trial_config_patch_replaces_trial_features`
- `admin_restaurant_subscription_get`
- `admin_restaurant_subscription_patch_changes_plan`
- `admin_restaurant_subscription_patch_extends_trial`
- `admin_restaurant_feature_overrides_set`
- `admin_plan_change_requests_list_pagination_filter_status`
- `admin_plan_change_request_approve_creates_event`
- `admin_plan_change_request_reject_with_notes`
- `admin_subscription_events_list_filterable`
- `admin_dependency_cycle_returns_400`

**`test_api_owner.py`**
- `owner_get_subscription_returns_plan_and_features`
- `owner_get_subscription_includes_trial_end_when_in_trial`
- `owner_get_plans_list_only_active_visible`
- `owner_create_plan_change_request_pending`
- `owner_create_change_request_conflict_when_pending_exists` (409)
- `owner_cancel_subscription_directly_schedules_downgrade`
- `owner_cancel_already_cancelled_returns_idempotent_400`
- `operator_role_cannot_access_owner_billing_endpoints` (403)
- `cliente_role_cannot_access_owner_billing_endpoints` (403)

**`test_auth_payload.py`**
- `me_endpoint_returns_subscription_for_owner`
- `me_endpoint_returns_subscription_for_operator`
- `me_endpoint_returns_null_subscription_for_cliente`
- `me_features_reflect_plan_change`
- `me_features_reflect_override_change`
- `me_features_change_after_trial_expiration` (mock trial_end)

**`test_tasks.py`**
- `expire_trials_task_only_processes_expired`
- `expire_trials_task_idempotent_double_run`
- `process_scheduled_downgrades_only_past_period_end`
- `process_scheduled_downgrades_idempotent`
- `tasks_create_audit_events`

**`test_init.py`**
- `ensure_billing_catalogs_creates_11_features`
- `ensure_billing_catalogs_idempotent`
- `seed_plans_creates_free_plan_with_is_free_true`
- `seed_plans_creates_default_trial_plan`
- `seed_trial_config_singleton_created`

**`test_migration_compat.py`**
- `existing_subscription_plans_migrated_to_billing_plan_by_code`
- `restaurants_keep_plan_after_fk_swap`
- `restaurant_without_subscription_gets_backfilled`

### Frontend Vitest (unitarios)

- `use-plan-feature.test.js` — retorna `canView/canCreate/canEdit/canDelete`; fallback all-true para admin; `isLocked` cuando `!canView`; expone `planCode`.
- `feature-gate.test.jsx` — renderiza children con feature habilitada; oculta sin feature; renderiza fallback si se pasa; respeta prop `action`.
- `locked-action.test.jsx` — renderiza ícono Lock; tooltip con plan requerido; click prevenido; `aria-disabled=true`.
- `plan-protected-route.test.jsx` — permite si feature presente; redirige a `/suscripcion` si falta; bypassea para admin.
- `owner-sidebar.test.jsx` — oculta item cuando `!features[module].can_view`; muestra todos cuando features completos.

### Frontend Playwright E2E

- `billing-admin-flow.test.js` — Admin crea Plan "Pro" con features, asigna a restaurante X; owner refresca y ve cambios reflejados en sidebar y vistas.
- `billing-owner-flow.test.js` — Owner ve trial con días restantes; solicita upgrade; admin (otra sesión) aprueba; owner ve plan Pro tras refresh; cancela; ve banner "vence el DD/MM".
- `feature-locks.test.js` — Owner plan free navega a `/dashboard/restaurante/lealtad` → redirige a `/suscripcion`; con `can_view` pero sin `can_create` ve botón "Crear" con candado; hover → tooltip "Mejora a Pro".
- `trial-expiration.test.js` — Factory crea restaurant con `trial_end=ayer`; dispara `expire_trials_task` (management command); owner login → sidebar reducido a plan free.
- `dependencies.test.js` — Admin crea Feature "lealtad" depends_on "clientes"; intenta asignar "lealtad" SIN "clientes" a plan → 400 con mensaje claro; toggle "auto-expand deps" → clientes se agrega solo.

---

## Orden recomendado de PRs

1. **Modelos + admin Django + tests modelos** — apps/billing creado, 9 modelos, migración 0001, factories.
2. **Seed catálogos + servicios features/dependencies + tests** — `init_scripts/`, `services/features.py`, `services/dependencies.py`, migración 0002, `apps/restaurants` AlterField, `test_init.py`, `test_migration_compat.py`.
3. **Servicios subscriptions/requests/events + signals + Celery tasks + tests** — `services/subscriptions.py`, `services/requests.py`, `services/events.py`, `signals.py`, `tasks.py`, beat schedule.
4. **Permisos billing + integración con OperatorModulePermission + tests** — `permissions.py`, `effective_can()` en `core/permissions.py`, aplicar a viewsets de menu/orders/loyalty/customers/etc.
5. **API Admin + serializers + tests** — `api/admin_views.py`, `api/admin_urls.py`, `api/serializers.py`, registro en router/urls.
6. **API Owner + tests** — `api/owner_views.py`, `api/owner_urls.py`.
7. **JWT payload extension + tests** — modificar `UserMeSerializer.get_subscription`.
8. **Frontend hooks + componentes core + tests Vitest** — `use-plan-feature`, `use-billing`, `use-effective-permission`, `feature-gate`, `locked-action`, `plan-protected-route`.
9. **Frontend páginas admin + owner** — planes, funcionalidades, solicitudes, suscripcion; banners; sidebars; extender admin restaurantes.jsx y configuracion.jsx; AuthContext.
10. **E2E Playwright + cleanup `platform_config.SubscriptionPlan`** — 5 tests E2E; migración final `platform_config/0003_remove_subscription_plan.py`.

---

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Data loss al migrar `SubscriptionPlan` → `billing.Plan` | Migración 0002 idempotente; guardar `legacy_id` en `Plan.metadata`; tabla legacy se mantiene 1 release |
| Restaurantes existentes sin `RestaurantSubscription` | Migración 0003 backfill; safety net en `get_active_subscription()` que crea default lazy |
| Race condition aprobación vs cancelación simultánea | `transaction.atomic()` + `select_for_update()` en `approve_request` y `cancel_subscription`; la perdedora marca `superseded` |
| Dependencias circulares en Features | `detect_cycle()` BFS al crear `FeatureDependency` + tests dedicados |
| N+1 en serialización JWT | `prefetch_related("plan__plan_features__feature", "restaurant__feature_overrides__feature")`; cachear `serialize_features_for_jwt` en Redis con TTL 60s |
| Plan FREE seedeado deja UX rota | Plan FREE incluye TODAS las 11 features con `can_view=True`, `can_create/edit/delete=False` (discovery-only) |
| `is_free` plan borrado por accidente | `on_delete=PROTECT` + serializer rechaza delete + `is_free` único en planes activos |
| Operadores existentes pierden permisos al migrar | Migración 0003 lee `OperatorPermission` actuales y crea `RestaurantFeatureOverride` espejo source="legacy" |
| Celery beat no corre en local | Documentar en `AGENTS.md` (`celery -A config beat`); fallback management command `expire_trials` para testing manual |
| Tests existentes rompen al cambiar FK | `SubscriptionPlanFactory` mantiene alias en `apps/restaurants/tests/factories.py` apuntando a `billing.PlanFactory` |

---

## Verificación end-to-end

Tras implementar cada PR:

```bash
# Backend
docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_IP=postgres -e PGB_POSTGRES_PORT=5432 \
  django python manage.py makemigrations --check

docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 \
  django python manage.py check

docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_IP=postgres -e PGB_POSTGRES_PORT=5432 \
  django pytest apps/billing/ -v

# Suite completa de regresión
docker compose -f docker-compose.local.yml run --rm \
  -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_IP=postgres -e PGB_POSTGRES_PORT=5432 \
  django pytest

# Frontend
cd frontend
pnpm test:run
pnpm test:e2e
pnpm lint
pnpm build
```

### Smoke test manual (después de PR 10)
1. Levantar stack: `docker compose -f docker-compose.local.yml up -d --remove-orphans` + `cd frontend && pnpm dev`.
2. Login como admin → ir a `/dashboard/admin/funcionalidades` → ver 11 features seedeadas con sus dependencias.
3. `/dashboard/admin/planes` → crear plan "Test Pro" con features menu+pedidos+inventario.
4. `/dashboard/admin/configuracion` tab Trial → configurar 30 días, plan trial = "Test Pro".
5. Registrar nuevo owner → confirmar que `/dashboard/restaurante/suscripcion` muestra trial activo con días restantes y features del plan trial.
6. Owner intenta acceder a `/dashboard/restaurante/lealtad` (sin feature) → redirige a `/suscripcion`.
7. Owner ve botón "Crear" con candado en una vista con `can_view` pero sin `can_create`.
8. Owner solicita upgrade a otro plan → admin aprueba en `/dashboard/admin/solicitudes` → owner refresca y ve plan actualizado.
9. Owner cancela → banner muestra fecha de vencimiento.
10. Forzar `current_period_end` en BD a fecha pasada → ejecutar `python manage.py shell` y disparar `process_scheduled_downgrades_task.delay()` → owner ahora tiene plan FREE.

---

## Critical files for implementation

- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/models.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/services/features.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/services/subscriptions.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/services/dependencies.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/permissions.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/tasks.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/init_scripts/catalogs.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/migrations/0001_initial.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/migrations/0002_data_migrate_subscription_plans.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/billing/migrations/0003_create_default_subscriptions.py`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/restaurants/models.py` (cambio FK)
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/custom_auth/api/serializers.py` (JWT subscription)
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend/apps/core/permissions.py` (`effective_can` helper)
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/hooks/use-plan-feature.js`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/hooks/use-effective-permission.js`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/components/auth/plan-protected-route.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/components/auth/feature-gate.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/components/ui/locked-action.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/components/billing/plan-features-matrix.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/pages/dashboard/admin/planes.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/pages/dashboard/admin/funcionalidades.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/pages/dashboard/admin/solicitudes.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/pages/dashboard/restaurante/suscripcion.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/context/auth-context.jsx`
- `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/frontend/src/App.jsx`
