# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

**Backend:** Django 6 + DRF + Django Channels (WebSockets) + Celery + PostgreSQL + Redis  
**Frontend:** React 19 + Vite + React Router 7 + Tailwind v4 + Shadcn/ui (Radix)  
**Package manager (frontend):** pnpm  

---

## Commands

### Backend — all commands run inside Docker

```bash
# Start all services (Django :8000, Postgres, Redis, Celery worker/beat, Flower :5555)
docker compose -f docker-compose.local.yml up -d --remove-orphans

# Shorthand alias used throughout
alias dm="docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django"

dm python manage.py migrate
dm python manage.py makemigrations
dm pytest                        # run all tests
dm pytest apps/orders/           # run a single app
dm pytest -k test_create_order   # run a single test
dm ruff check . --fix
dm ruff format .
dm pre-commit run --all-files
```

`backend/justfile` has shortcuts: `just build`, `just up`, `just down`, `just manage <args>`, `just logs`.

### Frontend

```bash
cd frontend
pnpm dev          # dev server on :5174
pnpm build
pnpm lint
pnpm test         # Vitest watch
pnpm test:run     # Vitest single run
pnpm test:e2e     # Playwright
```

---

## Architecture

### Roles & permissions

There are four roles: `admin`, `restaurante` (owner), `operador` (restaurant staff), `cliente`.

The backend enforces this via DRF permission classes in `backend/apps/core/permissions.py`:
- `IsOwnerRole`, `IsOwnerOrAdminRole`, `IsOwnerOfRestaurantResourceOrAdminRole` — owner checks
- `OperatorModulePermission` — checks `operator_permissions` payload on the JWT for module-level CRUD access (modules: `pedidos`, `menu`, `inventario`, `clientes`, `resenas`, `analiticas`)

Helper functions: `user_has_role()`, `is_owner_user()`, `is_operator_user()`, `operator_can(module, action, user)`.

The frontend mirrors this in `frontend/src/components/auth/protected-route.jsx` (checks `activeRole`) and `frontend/src/hooks/use-operator-permission.js`.

**Owner-only routes must be double-gated**: the sidebar hides the link (via `ownerOnlyItems` in `owner-sidebar.jsx`) AND the route in `App.jsx` must wrap the element in its own `<ProtectedRoute allowedRoles={["restaurante", "dueno"]}>`. The parent `ProtectedRoute` for `/dashboard/restaurante` allows `operador`, so child routes that should be owner-only need their own wrapper.

### Auth flow

- JWT: 15-min access token + 7-day refresh token (HttpOnly cookie).
- Frontend token lifecycle lives in `frontend/src/lib/api.js`: `apiRequest()` auto-retries on 401 by calling `refreshAccessToken()`, then fires `onAuthFailure()` listeners on second failure.
- `AuthContext` (`frontend/src/context/auth-context.jsx`) holds `user`, `activeRole`, and session state consumed via `useAuth()`.
- After login, `resolvePostAuthPath(role, requestedPath)` in `auth-routing.js` ensures each role lands on its own dashboard prefix.

### Real-time orders (WebSockets)

- Django Channels + Redis channel layer for WebSocket connections (`backend/config/asgi.py`, `backend/config/websocket.py`).
- Owners receive live order updates via a private channel keyed to their restaurant.
- Frontend hook: `use-owner-order-notifications()` in `frontend/src/hooks/`.
- Order status catalog (`OrderType`, `OrderStatus`) is seeded via a `post_migrate` signal in the orders app, not migrations.

### API layer (frontend)

All HTTP calls go through `frontend/src/lib/api.js`:
- `apiJson(path, options)` — handles JSON parsing + error bubbling.
- `apiRequest(path, options)` — raw fetch with token injection and 401 retry.
- Base URL from `VITE_API_URL` env var (default `http://localhost:8000`).

Domain-specific logic lives in `frontend/src/hooks/use-restaurants.js`, `use-orders.js`, etc. — these wrap `apiJson` and expose React state. Raw service functions for non-hook contexts live in `frontend/src/services/`.

### Backend URL routing

```
/admin-django/          → Django admin
/api/auth/              → JWT endpoints (login, refresh, logout)
/api/                   → DRF router (api_router.py)
/api/docs/              → Swagger UI
/api/schema/            → OpenAPI schema
```

Operator-specific API URLs are registered separately in `backend/apps/restaurants/api/operator_urls.py`.

### Testing conventions

- Backend uses `pytest-django` with `--reuse-db`. Settings: `config.settings.test`.
- A test that needs the DB must be marked `@pytest.mark.django_db`.
- CI runs `makemigrations --check` before pytest — always create migrations before pushing.
- Frontend unit tests use Vitest; E2E uses Playwright (`frontend/e2e/`).

---

## Key environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL for the frontend |
| `DATABASE_URL` | PostgreSQL DSN |
| `REDIS_URL` | Redis for cache, Celery, and Channels |
| `DJANGO_SECRET_KEY` | Django secret |
| `FRONTEND_URL` | Used for operator invitation email links |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Required for cross-origin cookie auth |
