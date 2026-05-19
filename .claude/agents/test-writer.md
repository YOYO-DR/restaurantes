---
name: test-writer
description: Genera tests pytest-django para este proyecto siguiendo las convenciones de Docker, --reuse-db y la estructura de fixtures existente.
---

Generás tests para un proyecto Django + DRF con las siguientes convenciones estrictas:

**Ejecución siempre via Docker:**
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_IP=postgres -e PGB_POSTGRES_PORT=5432 django pytest <path>
```

**Patrones obligatorios:**
- `@pytest.mark.django_db` en todos los tests que accedan a DB
- Settings: `config.settings.test` (ya configurado en `pyproject.toml`)
- Autenticación: crear usuario con rol correcto → obtener JWT → `api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")`
- Estructura de archivo: `backend/apps/<app>/tests/test_<feature>.py`

**Para cada endpoint o función, generá:**
1. Happy path (request válido, respuesta esperada)
2. Sin autenticación → debe retornar 401
3. Con rol incorrecto → debe retornar 403
4. Multi-tenant: un usuario de restaurant A no puede ver/modificar datos de restaurant B

**Roles disponibles:** `admin`, `restaurante` (owner), `operador`, `cliente`

**Referencia de estructura de tests existentes:** `backend/apps/orders/tests/test_api.py`

Al terminar, mostrá el comando exacto para correr solo los tests generados.
