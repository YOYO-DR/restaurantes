---
name: pr-check
description: Corre el checklist completo pre-PR para este proyecto: ruff, django check, migraciones pendientes, pytest de apps modificadas, y eslint frontend
disable-model-invocation: true
---

Corré en orden y reportá el resultado de cada paso. Si un paso falla, detenete y mostrá el error completo.

**Directorio base:** `/home/yoiner/Escritorio/programacion/proyectos/restaurantes`

1. **Backend lint (ruff):**
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django ruff check . && ruff format --check .
```

2. **Django system check:**
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py check
```

3. **Migraciones pendientes (no debe haber ninguna sin crear):**
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py makemigrations --check
```

4. **Tests de apps modificadas** — detectar apps con `git diff --name-only HEAD | grep 'backend/apps/'`, extraer nombre de app, y correr:
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_IP=postgres -e PGB_POSTGRES_PORT=5432 django pytest apps/<app>/
```

5. **Frontend lint:**
```bash
cd frontend && pnpm lint
```

Terminá con un resumen: ✓ pasos que pasaron / ✗ pasos que fallaron.
