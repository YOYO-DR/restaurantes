# Plan de implementacion

## Objetivo

Conectar frontend y backend por verticales de negocio, dejando permisos claros para cliente, dueno/restaurante y admin.

## Matriz de permisos inicial

### Cliente

- Puede ver listado de restaurantes y detalle publico.
- Puede ver menu publico y agregar productos al carrito local.
- Puede crear pedidos propios cuando el vertical de ordenes quede listo.
- Puede ver solo su dashboard, perfil, pedidos, favoritos, direcciones y puntos.
- No puede gestionar menu, inventario, clientes ni configuracion del restaurante.

### Dueno / Restaurante

- Puede acceder solo a sus restaurantes.
- Puede ver y gestionar categorias, platos, disponibilidad, inventario, pedidos, clientes y configuracion de su restaurante.
- No puede ver dashboards ni recursos privados de otros restaurantes.
- No puede entrar a vistas de cliente autenticado como si fueran su panel principal.

### Admin

- Puede ver dashboards globales, usuarios, restaurantes, reportes y configuracion de plataforma.
- Puede auditar recursos, pero no debe reutilizar vistas privadas del dueno sin una capa administrativa propia.

## Orden recomendado de implementacion

1. Vertical publico de restaurantes y menu.
2. Vertical de gestion de menu para dueno.
3. Vertical de pedidos cliente + dueno.
4. Vertical de perfil, direcciones y favoritos para cliente.
5. Vertical de inventario, analiticas y clientes para dueno.
6. Vertical administrativo y reportes globales.

## Vertical iniciado en este cambio

### Backend

- API publica de restaurantes:
  - `GET /api/restaurants/`
  - `GET /api/restaurants/{slug}/`
  - `GET /api/restaurants/{slug}/menu/`
- API privada para dueno:
  - `GET /api/owner/restaurants/`
  - `GET /api/owner/restaurants/{id}/menu/`
  - `PATCH /api/owner/menu-items/{id}/availability/`

### Frontend

- Listado publico de restaurantes conectado a backend.
- Vista publica de restaurante conectada a backend.
- Carrito local basado en items reales del menu.
- Vista de menu del dueno conectada a backend con cambio de disponibilidad.

## Siguientes pasos concretos

1. Agregar CRUD completo de categorias y platos para dueno.
2. Crear endpoint y flujo de checkout/pedidos.
3. Conectar dashboard de dueno con pedidos reales.
4. Conectar dashboard y vistas del cliente con pedidos, favoritos y perfil.
5. Endurecer permisos DRF por accion y por objeto en todos los dominios.
