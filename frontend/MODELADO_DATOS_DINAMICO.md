# Modelado de Datos Dinamico (Frontend FoodHub)

Este documento define un modelo relacional completo para soportar la logica actual del frontend, eliminando datos quemados y moviendo toda la variabilidad a tablas, catalogos y vistas.

## Objetivos

| Objetivo | Resultado esperado |
|---|---|
| Quitar hardcode en UI | Todo sale de tablas y vistas |
| Evitar redundancia | Catalogos para estados, tipos y configuraciones |
| Soportar roles actuales | Admin, Cliente, Restaurante (dueno) |
| Escalar dashboards | Vistas agregadas para metricas |
| Mantener flexibilidad | Configuracion por plataforma y por restaurante |

## Convenciones

| Convencion | Regla |
|---|---|
| PK | `id` UUID (excepto tablas pivote compuestas) |
| FK | `<entidad>_id` |
| Fechas | `created_at`, `updated_at` (timestamp with time zone) |
| Soft delete | `deleted_at` nullable cuando aplique |
| Multi-tenant | Toda entidad operativa referencia `restaurant_id` cuando corresponda |
| Moneda | `amount` decimal + `currency_code` |

---

## 1) Seguridad, usuarios y roles

### 1.1 `roles`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| code | varchar(50) | No | UNIQUE (`admin`, `cliente`, `restaurante`) |
| name | varchar(100) | No |  |
| created_at | timestamptz | No | default now() |

### 1.2 `user_statuses` (catalogo)
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | smallint | No | PK |
| code | varchar(30) | No | UNIQUE (`activo`, `inactivo`, `suspendido`) |
| name | varchar(80) | No |  |

### 1.3 `users`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| email | citext | No | UNIQUE |
| password_hash | text | No |  |
| first_name | varchar(120) | No |  |
| last_name | varchar(120) | No |  |
| phone | varchar(30) | Sí | INDEX |
| status_id | smallint | No | FK -> `user_statuses.id` |
| avatar_url | text | Sí |  |
| last_login_at | timestamptz | Sí |  |
| created_at | timestamptz | No | default now() |
| updated_at | timestamptz | No | default now() |
| deleted_at | timestamptz | Sí |  |

### 1.4 `user_roles`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| user_id | uuid | No | FK -> `users.id` |
| role_id | uuid | No | FK -> `roles.id` |
| assigned_at | timestamptz | No | default now() |
| assigned_by_user_id | uuid | Sí | FK -> `users.id` |

PK compuesta: (`user_id`, `role_id`)

### 1.5 `user_sessions`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| user_id | uuid | No | FK -> `users.id` |
| refresh_token_hash | text | No | UNIQUE |
| device_name | varchar(120) | Sí |  |
| ip_address | inet | Sí |  |
| user_agent | text | Sí |  |
| city | varchar(120) | Sí |  |
| country | varchar(120) | Sí |  |
| is_current | boolean | No | default false |
| last_seen_at | timestamptz | No |  |
| expires_at | timestamptz | No |  |
| created_at | timestamptz | No | default now() |

### 1.6 `action_catalog` y `role_action_permissions`
| Tabla | Proposito |
|---|---|
| `action_catalog` | Acciones del sistema (gestionar_usuarios, gestionar_menu, etc.) |
| `role_action_permissions` | Matriz rol-accion para habilitar UI/operaciones sin hardcode |

---

## 2) Restaurantes y configuracion operativa

### 2.1 `subscription_plans`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| code | varchar(40) | No | UNIQUE (`basico`, `profesional`, `empresarial`) |
| name | varchar(100) | No |  |
| billing_period | varchar(20) | No | (`monthly`, `yearly`) |
| price_amount | numeric(12,2) | No |  |
| currency_code | char(3) | No |  |
| is_active | boolean | No | default true |
| created_at | timestamptz | No | default now() |

### 2.2 `restaurant_statuses` (catalogo)
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | smallint | No | PK |
| code | varchar(30) | No | UNIQUE (`activo`, `inactivo`, `suspendido`, `pausado`) |
| name | varchar(80) | No |  |

### 2.3 `restaurant_categories` (catalogo)
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| code | varchar(60) | No | UNIQUE |
| name | varchar(120) | No |  |

### 2.4 `restaurants`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| owner_user_id | uuid | No | FK -> `users.id` |
| category_id | uuid | Sí | FK -> `restaurant_categories.id` |
| subscription_plan_id | uuid | No | FK -> `subscription_plans.id` |
| status_id | smallint | No | FK -> `restaurant_statuses.id` |
| slug | varchar(160) | No | UNIQUE |
| display_name | varchar(180) | No |  |
| legal_name | varchar(180) | Sí |  |
| nit | varchar(40) | Sí | UNIQUE nullable |
| email | citext | Sí |  |
| phone | varchar(30) | Sí |  |
| description | text | Sí |  |
| average_rating | numeric(3,2) | No | default 0 |
| total_reviews | integer | No | default 0 |
| created_at | timestamptz | No | default now() |
| updated_at | timestamptz | No | default now() |

### 2.5 `restaurant_addresses`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| line1 | varchar(220) | No |  |
| line2 | varchar(220) | Sí |  |
| city | varchar(120) | No |  |
| state | varchar(120) | Sí |  |
| country | varchar(120) | No |  |
| postal_code | varchar(20) | Sí |  |
| latitude | numeric(10,7) | Sí |  |
| longitude | numeric(10,7) | Sí |  |
| is_primary | boolean | No | default true |

### 2.6 `restaurant_hours`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| weekday | smallint | No | 0-6 |
| open_time | time | Sí |  |
| close_time | time | Sí |  |
| is_closed | boolean | No | default false |

UNIQUE (`restaurant_id`, `weekday`)

### 2.7 `restaurant_order_capabilities`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| restaurant_id | uuid | No | PK, FK -> `restaurants.id` |
| delivery_enabled | boolean | No | default true |
| pickup_enabled | boolean | No | default true |
| table_order_enabled | boolean | No | default false |

### 2.8 `restaurant_delivery_settings`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| restaurant_id | uuid | No | PK, FK -> `restaurants.id` |
| delivery_fee_amount | numeric(12,2) | No | default 0 |
| free_delivery_from_amount | numeric(12,2) | Sí |  |
| min_order_amount | numeric(12,2) | Sí |  |
| estimated_min_minutes | integer | Sí |  |
| estimated_max_minutes | integer | Sí |  |
| coverage_radius_km | numeric(6,2) | Sí |  |

### 2.9 `restaurant_payment_settings`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| restaurant_id | uuid | No | PK, FK -> `restaurants.id` |
| card_enabled | boolean | No | default true |
| pse_enabled | boolean | No | default false |
| cash_enabled | boolean | No | default true |
| nequi_enabled | boolean | No | default false |
| invoice_enabled | boolean | No | default false |
| invoice_prefix | varchar(20) | Sí |  |

### 2.10 `restaurant_branding`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| restaurant_id | uuid | No | PK, FK -> `restaurants.id` |
| logo_url | text | Sí |  |
| cover_url | text | Sí |  |
| primary_color | varchar(15) | Sí |  |
| secondary_color | varchar(15) | Sí |  |
| menu_view_style | varchar(30) | No | FK logica -> catalogo UI |
| category_nav_style | varchar(30) | No | FK logica -> catalogo UI |
| cart_position | varchar(30) | No | FK logica -> catalogo UI |
| dark_mode_enabled | boolean | No | default false |

### 2.11 `restaurant_social_links`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| restaurant_id | uuid | No | PK, FK -> `restaurants.id` |
| instagram_url | text | Sí |  |
| facebook_url | text | Sí |  |
| tiktok_url | text | Sí |  |
| whatsapp_number | varchar(30) | Sí |  |

---

## 3) Menu, categorias e inventario

### 3.1 `menu_categories`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| slug | varchar(120) | No |  |
| name | varchar(140) | No |  |
| sort_order | integer | No | default 0 |
| is_active | boolean | No | default true |

UNIQUE (`restaurant_id`, `slug`)

### 3.2 `menu_items`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| menu_category_id | uuid | No | FK -> `menu_categories.id` |
| slug | varchar(140) | No |  |
| name | varchar(180) | No |  |
| description | text | Sí |  |
| price_amount | numeric(12,2) | No |  |
| currency_code | char(3) | No |  |
| is_available | boolean | No | default true |
| is_popular | boolean | No | default false |
| prep_time_minutes | integer | Sí |  |
| created_at | timestamptz | No | default now() |
| updated_at | timestamptz | No | default now() |

UNIQUE (`restaurant_id`, `slug`)

### 3.3 `menu_item_images`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| menu_item_id | uuid | No | FK -> `menu_items.id` |
| image_url | text | No |  |
| sort_order | integer | No | default 0 |
| is_primary | boolean | No | default false |

### 3.4 `menu_tags` y `menu_item_tags`
| Tabla | Clave | Uso |
|---|---|---|
| `menu_tags` | (`id`, `code`, `name`) | Etiquetas sin hardcode (`popular`, `nuevo`, etc.) |
| `menu_item_tags` | (`menu_item_id`, `menu_tag_id`) | Relacion N:M |

### 3.5 `inventory_items`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| sku | varchar(60) | Sí | UNIQUE por restaurante |
| name | varchar(160) | No |  |
| unit_code | varchar(20) | No | FK -> catalogo unidades |
| current_stock | numeric(14,3) | No | default 0 |
| min_stock | numeric(14,3) | Sí |  |
| max_stock | numeric(14,3) | Sí |  |
| updated_at | timestamptz | No | default now() |

### 3.6 `inventory_stock_movements`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| inventory_item_id | uuid | No | FK -> `inventory_items.id` |
| movement_type_code | varchar(30) | No | FK -> catalogo movimientos |
| quantity | numeric(14,3) | No |  |
| reason | text | Sí |  |
| created_by_user_id | uuid | Sí | FK -> `users.id` |
| created_at | timestamptz | No | default now() |

### 3.7 `menu_item_ingredients`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| menu_item_id | uuid | No | FK -> `menu_items.id` |
| inventory_item_id | uuid | No | FK -> `inventory_items.id` |
| quantity_required | numeric(14,3) | No |  |

PK compuesta: (`menu_item_id`, `inventory_item_id`)

---

## 4) Clientes: direcciones, favoritos, pagos

### 4.1 `address_types` (catalogo)
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | smallint | No | PK |
| code | varchar(30) | No | UNIQUE (`home`, `work`, `other`) |
| name | varchar(80) | No |  |

### 4.2 `customer_addresses`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| user_id | uuid | No | FK -> `users.id` |
| address_type_id | smallint | No | FK -> `address_types.id` |
| label | varchar(80) | Sí |  |
| line1 | varchar(220) | No |  |
| line2 | varchar(220) | Sí |  |
| city | varchar(120) | No |  |
| state | varchar(120) | Sí |  |
| country | varchar(120) | No |  |
| latitude | numeric(10,7) | Sí |  |
| longitude | numeric(10,7) | Sí |  |
| notes | text | Sí |  |
| is_default | boolean | No | default false |
| created_at | timestamptz | No | default now() |

### 4.3 `payment_method_types` y `customer_payment_methods`
| Tabla | Columnas principales |
|---|---|
| `payment_method_types` | `id`, `code`, `name` (`card`, `pse`, `cash`, `nequi`) |
| `customer_payment_methods` | `id`, `user_id`, `payment_method_type_id`, `provider_token`, `masked_number`, `brand`, `expires_at`, `is_default` |

### 4.4 `favorites`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| user_id | uuid | No | FK -> `users.id` |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| created_at | timestamptz | No | default now() |

PK compuesta: (`user_id`, `restaurant_id`)

---

## 5) Pedidos y checkout

### 5.1 Catalogos de pedidos
| Tabla | Valores recomendados |
|---|---|
| `order_types` | `delivery`, `pickup`, `table` |
| `order_statuses` | `nuevo`, `confirmado`, `preparando`, `listo`, `en_camino`, `entregado`, `cancelado` |

### 5.2 `restaurant_tables`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| table_number | varchar(20) | No |  |
| capacity | integer | No |  |
| table_status_code | varchar(30) | No | FK -> catalogo estados mesa |
| created_at | timestamptz | No | default now() |

UNIQUE (`restaurant_id`, `table_number`)

### 5.3 `orders`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| order_code | varchar(40) | No | UNIQUE |
| user_id | uuid | No | FK -> `users.id` |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| order_type_id | smallint | No | FK -> `order_types.id` |
| status_id | smallint | No | FK -> `order_statuses.id` |
| subtotal_amount | numeric(12,2) | No |  |
| delivery_fee_amount | numeric(12,2) | No | default 0 |
| service_fee_amount | numeric(12,2) | No | default 0 |
| discount_amount | numeric(12,2) | No | default 0 |
| total_amount | numeric(12,2) | No |  |
| currency_code | char(3) | No |  |
| customer_notes | text | Sí |  |
| created_at | timestamptz | No | default now() |
| updated_at | timestamptz | No | default now() |

### 5.4 `order_items`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| order_id | uuid | No | FK -> `orders.id` |
| menu_item_id | uuid | Sí | FK -> `menu_items.id` |
| item_name_snapshot | varchar(180) | No |  |
| unit_price_amount | numeric(12,2) | No |  |
| quantity | integer | No |  |
| line_total_amount | numeric(12,2) | No |  |

### 5.5 `order_fulfillments`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| order_id | uuid | No | PK, FK -> `orders.id` |
| delivery_address_id | uuid | Sí | FK -> `customer_addresses.id` |
| table_id | uuid | Sí | FK -> `restaurant_tables.id` |
| estimated_min_minutes | integer | Sí |  |
| estimated_max_minutes | integer | Sí |  |
| delivered_at | timestamptz | Sí |  |

### 5.6 `order_status_history`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| order_id | uuid | No | FK -> `orders.id` |
| status_id | smallint | No | FK -> `order_statuses.id` |
| changed_by_user_id | uuid | Sí | FK -> `users.id` |
| comment | text | Sí |  |
| changed_at | timestamptz | No | default now() |

### 5.7 `order_payment_transactions`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| order_id | uuid | No | FK -> `orders.id` |
| payment_method_type_id | smallint | No | FK -> `payment_method_types.id` |
| provider_name | varchar(80) | Sí |  |
| provider_reference | varchar(120) | Sí |  |
| amount | numeric(12,2) | No |  |
| currency_code | char(3) | No |  |
| payment_status_code | varchar(30) | No | FK -> catalogo pagos |
| paid_at | timestamptz | Sí |  |
| created_at | timestamptz | No | default now() |

---

## 6) Reseñas, lealtad y notificaciones

### 6.1 `reviews` y `review_responses`
| Tabla | Columnas principales |
|---|---|
| `reviews` | `id`, `order_id`, `restaurant_id`, `user_id`, `rating`, `comment`, `created_at` |
| `review_responses` | `id`, `review_id`, `restaurant_user_id`, `response_text`, `created_at` |

### 6.2 Lealtad
| Tabla | Columnas principales |
|---|---|
| `loyalty_tiers` | `id`, `code`, `name`, `min_points`, `max_points` |
| `loyalty_accounts` | `id`, `user_id`, `current_points`, `lifetime_points`, `tier_id` |
| `loyalty_rewards` | `id`, `restaurant_id`, `name`, `points_cost`, `is_active` |
| `loyalty_transactions` | `id`, `loyalty_account_id`, `order_id`, `tx_type_code`, `points_delta`, `created_at` |
| `loyalty_redemptions` | `id`, `loyalty_transaction_id`, `loyalty_reward_id`, `status_code` |

### 6.3 Notificaciones
| Tabla | Columnas principales |
|---|---|
| `notification_channels` | `id`, `code`, `name` (`email`, `push`, `sms`, `in_app`, `sound`, `printer`) |
| `notification_types` | `id`, `code`, `name`, `audience_role_code` |
| `user_notification_preferences` | `id`, `user_id`, `notification_channel_id`, `notification_type_id`, `is_enabled` |
| `notification_events` | `id`, `user_id`, `notification_type_id`, `payload_json`, `sent_at`, `read_at` |

---

## 7) QR y personalizacion visual

### 7.1 `qr_codes`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| restaurant_id | uuid | No | FK -> `restaurants.id` |
| target_type_code | varchar(30) | No | (`table`, `menu`, `payment`) |
| target_id | uuid | Sí | FK segun target |
| qr_url | text | No |  |
| is_active | boolean | No | default true |
| created_at | timestamptz | No | default now() |

### 7.2 Catalogos de UI (sin hardcode)
| Tabla | Valores ejemplo (catalogo) |
|---|---|
| `menu_layout_options` | `cards`, `list`, `grid` |
| `category_nav_styles` | `tabs`, `sidebar`, `dropdown` |
| `cart_positions` | `sidebar`, `bottom`, `floating` |
| `qr_export_formats` | `png`, `svg`, `pdf` |
| `qr_export_sizes` | `small`, `medium`, `large`, `xlarge` |

---

## 8) Configuracion global de plataforma

### 8.1 `platform_settings`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| platform_name | varchar(140) | No |  |
| support_email | citext | Sí |  |
| support_phone | varchar(30) | Sí |  |
| support_address | text | Sí |  |
| default_currency_code | char(3) | No |  |
| default_locale | varchar(15) | No |  |
| maintenance_mode | boolean | No | default false |
| updated_at | timestamptz | No | default now() |

### 8.2 `platform_security_settings`
| Columna | Tipo | Null | Restricciones |
|---|---|---|---|
| id | uuid | No | PK |
| require_2fa_admin | boolean | No | default false |
| require_restaurant_verification | boolean | No | default true |
| encrypt_payment_data | boolean | No | default true |
| backup_frequency_code | varchar(20) | No | FK -> catalogo frecuencias |
| backup_retention_days | integer | No |  |
| updated_at | timestamptz | No | default now() |

---

## 9) Relaciones principales (resumen)

| Origen | Relacion | Destino |
|---|---|---|
| `users` | 1:N | `user_sessions` |
| `users` | N:M | `roles` via `user_roles` |
| `users` | 1:N | `customer_addresses`, `favorites`, `orders`, `reviews` |
| `users` | 1:1 | `restaurants` (owner) |
| `restaurants` | 1:N | `menu_categories`, `menu_items`, `orders`, `reviews`, `restaurant_tables` |
| `menu_categories` | 1:N | `menu_items` |
| `menu_items` | N:M | `inventory_items` via `menu_item_ingredients` |
| `orders` | 1:N | `order_items`, `order_status_history`, `order_payment_transactions` |
| `orders` | 1:1 | `order_fulfillments` |
| `loyalty_accounts` | 1:N | `loyalty_transactions` |

---

## 10) Vistas dinamicas para dashboards

| Vista | Uso en frontend |
|---|---|
| `vw_admin_kpis` | Cards principales admin (usuarios, restaurantes, ordenes, ingresos) |
| `vw_admin_restaurants_list` | Tabla/tarjetas de gestion de restaurantes con filtros por estado |
| `vw_admin_users_list` | Tabla usuarios con filtros por rol/estado/busqueda |
| `vw_admin_reports_sales_timeseries` | Graficas de ventas/ordenes por periodo |
| `vw_admin_reports_category_mix` | Rendimiento por categoria de restaurante |
| `vw_owner_dashboard_summary` | KPIs de dueno: ventas, ticket promedio, pedidos, clientes |
| `vw_owner_orders_live` | Lista operativa de pedidos por estado |
| `vw_owner_top_menu_items` | Productos top y disponibilidad |
| `vw_owner_inventory_alerts` | Stock bajo/critico |
| `vw_owner_reviews_summary` | Resumen de rating y reseñas pendientes |
| `vw_client_dashboard_summary` | Pedidos recientes, favoritos, puntos |
| `vw_client_loyalty_progress` | Nivel y progreso de puntos |

Si el volumen crece, estas vistas se pueden convertir a materializadas (`mv_*`) con refresh programado.

---

## 11) Indices recomendados

| Tabla | Indices |
|---|---|
| `users` | UNIQUE(`email`), INDEX(`status_id`) |
| `restaurants` | UNIQUE(`slug`), INDEX(`status_id`), INDEX(`owner_user_id`) |
| `menu_items` | INDEX(`restaurant_id`, `menu_category_id`, `is_available`) |
| `orders` | INDEX(`restaurant_id`, `status_id`, `created_at`), INDEX(`user_id`, `created_at`) |
| `order_status_history` | INDEX(`order_id`, `changed_at`) |
| `reviews` | INDEX(`restaurant_id`, `created_at`) |
| `favorites` | PK compuesta (`user_id`,`restaurant_id`) |
| `inventory_items` | INDEX(`restaurant_id`, `current_stock`) |

---

## 12) Reglas anti-hardcode (obligatorias)

| Regla | Implementacion |
|---|---|
| Estados no en JS | Todos los estados salen de catalogos (`*_statuses`) |
| Roles no por email substring | Login devuelve `user_roles` desde DB |
| Slug dinamico real | `/restaurantes/:slug` consulta `restaurants.slug` |
| Filtros reales | Busqueda/estado/categoria atacan API con query params |
| Config visual no fija | Personalizacion sale de `restaurant_branding` + catalogos UI |
| Planes y permisos centralizados | `subscription_plans` y `role_action_permissions` |

---

## 13) Cobertura de la logica actual del frontend

| Modulo frontend | Cubierto por |
|---|---|
| Home (features, planes, CTA) | `subscription_plans`, catalogos de plataforma |
| Listado de restaurantes y filtros | `restaurants`, `restaurant_categories`, vistas listadas |
| Detalle restaurante + menu + carrito | `restaurants`, `menu_categories`, `menu_items`, `orders`, `order_items` |
| Login/registro/recuperacion | `users`, `roles`, `user_sessions`, `user_legal_acceptances` |
| Dashboard admin | vistas `vw_admin_*` + tablas maestras |
| Dashboard cliente | `orders`, `favorites`, `loyalty_*`, `customer_addresses` |
| Dashboard restaurante | `orders`, `menu_*`, `inventory_*`, `reviews`, `restaurant_*` |
| QR y personalizacion | `qr_codes`, `restaurant_branding`, catalogos UI |

---

## 14) Resultado

Este modelo elimina redundancias, evita datos quemados y permite operar toda la app con datos dinamicos, normalizados y extensibles.
