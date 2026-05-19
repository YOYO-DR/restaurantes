---
name: django-migrate
description: Corre el flujo completo de migraciones Django (makemigrations + migrate) via Docker Compose con las variables de entorno correctas
disable-model-invocation: true
---

Ejecutá este flujo completo de migración Django en orden:

1. **makemigrations:**
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py makemigrations
```

2. Mostrá las migraciones generadas (nombre de archivo y app).

3. **migrate:**
```bash
docker compose -f docker-compose.local.yml run --rm -e PGB_POSTGRES_HOST=postgres -e PGB_POSTGRES_PORT=5432 django python manage.py migrate
```

4. Confirmá que todo aplicó sin errores. Si hay errores, mostralos completos sin truncar.

Todos los comandos se corren desde: `/home/yoiner/Escritorio/programacion/proyectos/restaurantes/backend`
