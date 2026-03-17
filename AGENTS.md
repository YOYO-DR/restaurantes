# AGENTS.md

Repository guide for coding agents working in this project.

Scope: applies to the whole repository (`backend/` + `frontend/`).

## 1) Critical execution rule (Backend)

For **any backend command** (manage.py, tests, lint, migrations, shell), run it through Docker Compose with this exact prefix:

```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django
```

Examples in this document use that prefix and assume working directory: `backend/`.

## 2) Project layout

- `backend/`: Django + Django REST Framework, cookiecutter-django style.
- `backend/apps/`: domain apps (`users`, `accounts`, `restaurants`, etc.).
- `backend/config/`: settings, URLs, API router.
- `frontend/`: React + Vite + pnpm.

## 3) Rules discovery (Cursor/Copilot)

Checked and **not found** in this repo:

- `.cursorrules`
- `.cursor/rules/`
- `.github/copilot-instructions.md`

If these appear later, treat them as higher-priority project instructions.

## 4) Setup & run commands

### Backend (Docker Compose only)

From `backend/`:

```bash
# Start local stack
docker compose -f docker-compose.local.yml up -d --remove-orphans

# Stop stack
docker compose -f docker-compose.local.yml down

# Django check
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py check

# Make migrations
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py makemigrations

# Apply migrations
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py migrate

# Django shell
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py shell
```

### Frontend

From `frontend/`:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm preview
```

## 5) Test commands (especially single test)

### Backend tests (pytest via Django settings)

From `backend/`:

```bash
# All tests
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest

# Single file
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest apps/users/tests/test_models.py

# Single test class
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest apps/users/tests/test_models.py::TestUserModel

# Single test function
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest apps/users/tests/test_models.py::TestUserModel::test_str

# Keyword filter
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest -k "user and not api"

# Coverage
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django coverage run -m pytest
```

### Frontend tests

No frontend test runner is currently configured in `package.json`.
If you add one (Vitest/Jest), document commands here.

## 6) Lint/format/type-check commands

### Backend

Preferred (matches repo hooks):

```bash
# Run all configured pre-commit checks
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pre-commit run --all-files

# Ruff lint + fixes
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django ruff check . --fix

# Ruff format
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django ruff format .

# Mypy
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django mypy .
```

### Frontend

```bash
pnpm lint
pnpm build
```

## 7) Backend code style guidelines

### Python version and tooling

- Python target: `3.13`.
- Lint/format: Ruff (`ruff-check`, `ruff-format`).
- Import sorting enforced by Ruff/isort (`force-single-line = true`).
- Type checking: mypy configured with django-stubs and drf stubs.

### Imports

- Use absolute imports from project root app namespace (e.g. `from apps.users.models import User`).
- Keep one import per line where formatter/linter expects it.
- Group order: stdlib, third-party, local.
- Avoid wildcard imports.

### Formatting and structure

- Let Ruff format code; do not manually fight formatter output.
- Keep functions focused and short.
- Prefer explicit names over short abbreviations.
- Keep migration files auto-generated unless manual migration is required.

### Types

- Add type hints for public functions/methods and non-trivial internals.
- Use `str | None` style unions.
- Avoid `Any` unless unavoidable; narrow types early.
- For Django model managers/querysets, keep compatible typing patterns.

### Naming conventions

- Django models: `PascalCase` singular.
- DB table names: set `db_table` when domain naming matters.
- Fields/variables/functions: `snake_case`.
- Constants: `UPPER_SNAKE_CASE`.
- App modules: lowercase, domain-oriented.

### Django/DRF patterns

- Keep domain separation by app (`accounts`, `orders`, `menu`, etc.).
- Shared abstractions live in `apps/core`.
- Prefer `on_delete=PROTECT` for reference data; `CASCADE` for true ownership.
- Add indexes/constraints for real query paths and uniqueness.
- Use serializers for validation and translation to API payloads.
- Use viewsets consistently; keep permissions explicit.

### Error handling

- Validate inputs early and fail with clear messages.
- Raise `ValidationError` for domain/data issues.
- Raise `ImproperlyConfigured` for missing required class config.
- Do not swallow exceptions silently.
- Keep API errors deterministic and parseable.

## 8) Frontend code style guidelines

- Stack: React 19 + Vite + JavaScript (JSX).
- Use `@/` alias for `src` imports.
- Components: `PascalCase` filenames for component modules where possible.
- Hooks: `useXxx` naming.
- Keep UI state local unless shared/global is required.
- Use existing design tokens and utility classes (Tailwind v4 setup in `src/index.css`).

## 9) Agent workflow expectations

- Before changing code, read nearby files and existing patterns.
- Keep changes minimal and domain-consistent.
- Run relevant lint/tests for touched area.
- If backend changed, run at least `manage.py check` using Docker prefix.
- If frontend changed, run `pnpm lint` and `pnpm build` when feasible.
- Do not introduce secrets or commit env files.

## 10) Quick command cheatsheet

From `backend/`:

```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py check
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django pytest apps/orders/tests/test_api.py::TestOrderViewSet::test_list
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django ruff check . --fix
```

From `frontend/`:

```bash
pnpm lint
pnpm build
```
