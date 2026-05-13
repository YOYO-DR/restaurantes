import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.menu.models import InventoryItem
from apps.menu.models import InventoryMovementType
from apps.menu.models import UnitType
from apps.orders.models import Order
from apps.orders.models import OrderItem
from apps.restaurants.models import Operador
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantReview
from apps.restaurants.models import TableStatus
from apps.restaurants.services import ensure_restaurant_branding
from apps.restaurants.tests.factories import CustomerAddressFactory
from apps.restaurants.tests.factories import MenuCategoryFactory
from apps.restaurants.tests.factories import MenuItemFactory
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantAddressFactory
from apps.restaurants.tests.factories import RestaurantDeliverySettingFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.restaurants.tests.factories import RestaurantHourFactory
from apps.restaurants.tests.factories import RestaurantOrderCapabilityFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def assign_role(user, code: str):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def create_restaurant_with_menu(owner=None, slug="el-buen-sabor") -> Restaurant:
    restaurant = RestaurantFactory(owner=owner or UserFactory(), slug=slug)
    RestaurantAddressFactory(restaurant=restaurant, city="Corinto")
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    RestaurantHourFactory(restaurant=restaurant, weekday=0)
    entradas = MenuCategoryFactory(
        restaurant=restaurant,
        slug="entradas",
        name="Entradas",
    )
    MenuItemFactory(
        restaurant=restaurant,
        menu_category=entradas,
        slug="empanadas",
        name="Empanadas",
        is_available=True,
    )
    MenuItemFactory(
        restaurant=restaurant,
        menu_category=entradas,
        slug="ajiaco",
        name="Ajiaco",
        is_available=False,
    )
    return restaurant


def test_public_restaurants_list(api_client: APIClient):
    create_restaurant_with_menu()

    response = api_client.get(reverse("api:restaurant-list"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["slug"] == "el-buen-sabor"
    assert response.data[0]["has_delivery"] is True


def test_public_restaurant_detail(api_client: APIClient):
    restaurant = create_restaurant_with_menu()
    branding = ensure_restaurant_branding(restaurant)
    branding.logo_file = SimpleUploadedFile(
        "logo.txt",
        b"logo-content",
        content_type="text/plain",
    )
    branding.cover_file = SimpleUploadedFile(
        "cover.txt",
        b"cover-content",
        content_type="text/plain",
    )
    branding.save(update_fields=["logo_file", "cover_file", "updated_at"])

    response = api_client.get(
        reverse("api:restaurant-detail", kwargs={"slug": restaurant.slug}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["slug"] == restaurant.slug
    assert response.data["address"]["city"] == "Corinto"
    assert "/restaurant-branding/logo" in response.data["logo_url"]
    assert "/restaurant-branding/cover" in response.data["cover_url"]
    assert response.data["tables"] == []


def test_public_restaurant_detail_returns_active_tables_for_table_orders(
    api_client: APIClient,
):
    restaurant = create_restaurant_with_menu()
    restaurant.order_capability.table_order_enabled = True
    restaurant.order_capability.save(
        update_fields=["table_order_enabled", "updated_at"],
    )
    active_status, _ = TableStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activa"},
    )
    inactive_status, _ = TableStatus.objects.get_or_create(
        code="inactive",
        defaults={"name": "Inactiva"},
    )
    restaurant.tables.create(table_number="1", capacity=4, status=active_status)
    restaurant.tables.create(table_number="4", capacity=2, status=active_status)
    restaurant.tables.create(table_number="2", capacity=6, status=inactive_status)

    response = api_client.get(
        reverse("api:restaurant-detail", kwargs={"slug": restaurant.slug}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["tables"] == [
        {"id": str(restaurant.tables.get(table_number="1").id), "table_number": "1"},
        {"id": str(restaurant.tables.get(table_number="4").id), "table_number": "4"},
    ]


def test_public_restaurant_menu_only_returns_available_items(api_client: APIClient):
    restaurant = create_restaurant_with_menu()

    response = api_client.get(
        reverse("api:restaurant-menu", kwargs={"slug": restaurant.slug}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data["categories"]) == 1
    items = response.data["categories"][0]["items"]
    assert len(items) == 1
    assert items[0]["slug"] == "empanadas"


def test_owner_can_view_own_restaurant_menu(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-restaurant-menu", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_200_OK
    items = response.data["categories"][0]["items"]
    assert len(items) == 2


def test_owner_cannot_view_other_restaurant_menu(api_client: APIClient):
    owner = UserFactory()
    other_owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=other_owner)
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-restaurant-menu", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_owner_cannot_view_other_restaurant_dashboard(api_client: APIClient):
    owner = UserFactory()
    other_owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=other_owner)
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-restaurant-dashboard", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_operator_can_view_assigned_restaurant_dashboard(api_client: APIClient):
    owner = UserFactory()
    operator = UserFactory()
    assign_role(owner, "restaurante")
    assign_role(operator, "operador")
    restaurant = create_restaurant_with_menu(owner=owner)
    Operador.objects.create(user=operator, restaurante=restaurant)
    api_client.force_authenticate(user=operator)

    response = api_client.get(
        reverse("api:owner-restaurant-dashboard", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["restaurant"]["id"] == str(restaurant.id)


def test_operator_cannot_view_unassigned_restaurant_dashboard(api_client: APIClient):
    owner = UserFactory()
    operator = UserFactory()
    assign_role(owner, "restaurante")
    assign_role(operator, "operador")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=operator)

    response = api_client.get(
        reverse("api:owner-restaurant-dashboard", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_owner_can_toggle_menu_item_availability(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    menu_item = restaurant.menu_items.get(slug="ajiaco")
    api_client.force_authenticate(user=owner)

    response = api_client.patch(
        reverse("api:owner-menu-item-availability", kwargs={"pk": menu_item.pk}),
        {"is_available": True},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    menu_item.refresh_from_db()
    assert menu_item.is_available is True


def test_client_cannot_toggle_owner_menu_item(api_client: APIClient):
    client_user = UserFactory()
    assign_role(client_user, "cliente")
    restaurant = create_restaurant_with_menu()
    menu_item = restaurant.menu_items.get(slug="empanadas")
    api_client.force_authenticate(user=client_user)

    response = api_client.patch(
        reverse("api:owner-menu-item-availability", kwargs={"pk": menu_item.pk}),
        {"is_available": False},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_owner_can_create_menu_category(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    response = api_client.post(
        reverse("api:owner-menu-category-list"),
        {
            "restaurant": str(restaurant.id),
            "name": "Bebidas",
            "description": "Jugos, sodas y bebidas frias",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["slug"] == "bebidas"
    assert response.data["sort_order"] == 0
    assert response.data["description"] == "Jugos, sodas y bebidas frias"


def test_owner_can_search_menu_categories(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    MenuCategoryFactory.create(restaurant=restaurant, name="Bebidas", slug="bebidas")
    MenuCategoryFactory.create(restaurant=restaurant, name="Postres", slug="postres")
    MenuCategoryFactory.create(restaurant=restaurant, name="Pizzas", slug="pizzas")
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-menu-category-list"),
        {"restaurant": str(restaurant.id), "search": "be", "limit": 1},
    )

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Bebidas"


def test_owner_can_list_inventory_items(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    unit_type, _ = UnitType.objects.get_or_create(
        code="kg",
        defaults={"name": "Kilogramos"},
    )
    InventoryItem.objects.create(
        restaurant=restaurant,
        unit_type=unit_type,
        name="Arroz",
        sku="ARZ-001",
        current_stock="25.000",
        min_stock="10.000",
        max_stock="50.000",
    )
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-inventory-item-list"),
        {"restaurant": str(restaurant.id), "search": "arr"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1
    assert response.data[0]["name"] == "Arroz"
    assert response.data[0]["status"] == "ok"


def test_owner_can_create_inventory_item_and_register_movement(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    unit_type, _ = UnitType.objects.get_or_create(
        code="kg",
        defaults={"name": "Kilogramos"},
    )
    InventoryMovementType.objects.get_or_create(
        code="stock_in",
        defaults={"name": "Entrada"},
    )
    api_client.force_authenticate(user=owner)

    create_response = api_client.post(
        reverse("api:owner-inventory-item-list"),
        {
            "restaurant": str(restaurant.id),
            "name": "Tomate",
            "sku": "TMT-001",
            "unit_type": str(unit_type.id),
            "current_stock": "8.00",
            "min_stock": "10.00",
            "max_stock": "20.00",
        },
        format="json",
    )

    assert create_response.status_code == status.HTTP_201_CREATED
    assert create_response.data["status"] == "low"

    movement_response = api_client.post(
        reverse(
            "api:owner-inventory-item-movements",
            kwargs={"pk": create_response.data["id"]},
        ),
        {
            "movement_type_code": "stock_in",
            "quantity": "5.00",
            "reason": "Compra",
        },
        format="json",
    )

    assert movement_response.status_code == status.HTTP_200_OK
    assert movement_response.data["current_stock"] == "13.00"


def test_owner_can_create_menu_item(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    category = restaurant.menu_categories.first()
    api_client.force_authenticate(user=owner)

    response = api_client.post(
        reverse("api:owner-menu-crud-item-list"),
        {
            "restaurant": str(restaurant.id),
            "menu_category": str(category.id),
            "name": "Limonada Natural",
            "price_amount": "7000.00",
            "is_available": True,
            "is_popular": False,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["slug"] == "limonada-natural"
    assert response.data["currency_code"] == restaurant.currency_code
    assert response.data["description"] == ""


def test_owner_can_create_menu_item_with_images(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    category = restaurant.menu_categories.first()
    api_client.force_authenticate(user=owner)

    response = api_client.post(
        reverse("api:owner-menu-crud-item-list"),
        {
            "restaurant": str(restaurant.id),
            "menu_category": str(category.id),
            "name": "Hamburguesa Especial",
            "price_amount": "25000.00",
            "primary_image": SimpleUploadedFile(
                "primary.jpg",
                b"primary-image-content",
                content_type="image/jpeg",
            ),
            "gallery_images": [
                SimpleUploadedFile(
                    "gallery-1.jpg",
                    b"gallery-image-content",
                    content_type="image/jpeg",
                ),
            ],
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_201_CREATED
    menu_item = restaurant.menu_items.get(slug="hamburguesa-especial")
    assert menu_item.images.count() == 2
    assert menu_item.images.filter(is_primary=True).count() == 1


def test_owner_can_remove_existing_gallery_image(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    category = restaurant.menu_categories.first()
    menu_item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        slug="plato-con-galeria",
        name="Plato con Galeria",
    )
    primary_image = menu_item.images.create(
        image_url="https://example.com/primary.jpg",
        is_primary=True,
        sort_order=0,
    )
    gallery_image = menu_item.images.create(
        image_url="https://example.com/gallery.jpg",
        is_primary=False,
        sort_order=1,
    )
    api_client.force_authenticate(user=owner)

    response = api_client.patch(
        reverse("api:owner-menu-crud-item-detail", kwargs={"pk": menu_item.pk}),
        {
            "remove_gallery_image_ids": [str(gallery_image.id)],
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_200_OK
    menu_item.refresh_from_db()
    assert menu_item.images.filter(pk=gallery_image.pk).exists() is False
    assert menu_item.images.filter(pk=primary_image.pk, is_primary=True).exists()


def test_owner_can_remove_existing_primary_image_without_promotion(
    api_client: APIClient,
):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    category = restaurant.menu_categories.first()
    menu_item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        slug="plato-con-principal",
        name="Plato con Principal",
    )
    primary_image = menu_item.images.create(
        image_url="https://example.com/primary.jpg",
        is_primary=True,
        sort_order=0,
    )
    gallery_image = menu_item.images.create(
        image_url="https://example.com/gallery.jpg",
        is_primary=False,
        sort_order=1,
    )
    api_client.force_authenticate(user=owner)

    response = api_client.patch(
        reverse("api:owner-menu-crud-item-detail", kwargs={"pk": menu_item.pk}),
        {
            "remove_primary_image": "true",
        },
        format="multipart",
    )

    assert response.status_code == status.HTTP_200_OK
    menu_item.refresh_from_db()
    assert menu_item.images.filter(pk=primary_image.pk).exists() is False
    gallery_image.refresh_from_db()
    assert gallery_image.is_primary is False
    assert menu_item.images.filter(is_primary=True).count() == 0


def test_owner_cannot_create_menu_item_for_other_restaurant(api_client: APIClient):
    owner = UserFactory()
    other_owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=other_owner)
    category = restaurant.menu_categories.first()
    api_client.force_authenticate(user=owner)

    response = api_client.post(
        reverse("api:owner-menu-crud-item-list"),
        {
            "restaurant": str(restaurant.id),
            "menu_category": str(category.id),
            "slug": "otro-plato",
            "name": "Otro Plato",
            "description": "No permitido",
            "price_amount": "10000.00",
            "is_available": True,
            "is_popular": False,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_owner_dashboard_returns_real_metrics(api_client: APIClient):
    owner = UserFactory()
    customer = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    address = CustomerAddressFactory(user=customer)
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderStatusFactory(code="new", name="Nuevo")

    api_client.force_authenticate(user=customer)
    api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [
                {
                    "menu_item_id": str(
                        restaurant.menu_items.filter(is_available=True).first().id,
                    ),
                    "quantity": 2,
                },
            ],
        },
        format="json",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.get(
        reverse("api:owner-restaurant-dashboard", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["restaurant"]["name"] == restaurant.display_name
    assert response.data["metrics"]["orders_today"] == 1
    assert len(response.data["recent_orders"]) == 1


def test_owner_can_get_restaurant_reviews(api_client: APIClient):
    owner = UserFactory()
    customer = UserFactory(name="Carlos Rodriguez")
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    restaurant.average_rating = "4.50"
    restaurant.total_reviews = 2
    restaurant.save(update_fields=["average_rating", "total_reviews"])
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    order_status = OrderStatusFactory(code="delivered", name="Entregado")
    order = Order.objects.create(
        order_code="REV-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=order_status,
        subtotal_amount="30000.00",
        total_amount="30000.00",
        currency_code="COP",
    )
    OrderItem.objects.create(
        order=order,
        item_name_snapshot="Bandeja Paisa",
        unit_price_amount="30000.00",
        quantity=1,
        line_total_amount="30000.00",
    )
    RestaurantReview.objects.create(
        restaurant=restaurant,
        user=customer,
        order=order,
        rating=5,
        comment="Excelente comida",
    )
    RestaurantReview.objects.create(
        restaurant=restaurant,
        user=UserFactory(name="Maria Garcia"),
        rating=4,
        comment="Muy rico",
        owner_reply="Gracias por visitarnos",
    )
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-restaurant-reviews", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_reviews"] == 2
    assert response.data["metrics"]["pending_replies"] == 1
    assert response.data["reviews"][0]["customer_name"] in {
        "Carlos Rodriguez",
        "Maria Garcia",
    }


def test_owner_can_reply_restaurant_review(api_client: APIClient):
    owner = UserFactory()
    customer = UserFactory(name="Ana Lopez")
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    review = RestaurantReview.objects.create(
        restaurant=restaurant,
        user=customer,
        rating=4,
        comment="Buen servicio",
    )
    api_client.force_authenticate(user=owner)

    response = api_client.post(
        reverse(
            "api:owner-restaurant-reply-review",
            kwargs={"pk": restaurant.pk, "review_id": review.pk},
        ),
        {"response": "Gracias por tu comentario"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    review.refresh_from_db()
    assert review.owner_reply == "Gracias por tu comentario"


def test_owner_can_get_qr_data_and_manage_tables(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    qr_response = api_client.get(
        reverse("api:owner-restaurant-qrs", kwargs={"pk": restaurant.pk}),
    )

    assert qr_response.status_code == status.HTTP_200_OK
    assert qr_response.data["menu_qr"]["url"].endswith(
        f"/restaurantes/{restaurant.slug}",
    )

    create_table_response = api_client.post(
        reverse("api:owner-restaurant-create-table", kwargs={"pk": restaurant.pk}),
        {"table_number": "12", "capacity": 4, "status_code": "active"},
        format="json",
    )

    assert create_table_response.status_code == status.HTTP_201_CREATED
    assert create_table_response.data["table_number"] == "12"
    assert "table=12" in create_table_response.data["qr_url"]

    update_table_response = api_client.patch(
        reverse(
            "api:owner-restaurant-update-table",
            kwargs={"pk": restaurant.pk, "table_id": create_table_response.data["id"]},
        ),
        {"status_code": "inactive"},
        format="json",
    )

    assert update_table_response.status_code == status.HTTP_200_OK
    assert update_table_response.data["status"] == "inactive"


def test_owner_can_get_restaurant_settings(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    response = api_client.get(
        reverse("api:owner-restaurant-settings", kwargs={"pk": restaurant.pk}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["business_name"] == restaurant.display_name
    assert response.data["city"] == "Corinto"
    assert response.data["currency_code"] == restaurant.currency_code
    assert response.data["delivery_enabled"] is True
    assert response.data["schedule"][0]["weekday"] == 0


def test_owner_can_update_restaurant_settings(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    response = api_client.patch(
        reverse("api:owner-restaurant-settings", kwargs={"pk": restaurant.pk}),
        {
            "business_name": "Nuevo Nombre",
            "phone": "+57 300 123 4567",
            "email": "nuevo@foodhub.co",
            "currency_code": "USD",
            "address": "Calle 10 #20-30",
            "city": "Popayan",
            "delivery_enabled": False,
            "pickup_enabled": True,
            "table_order_enabled": True,
            "delivery_fee_amount": "5000.00",
            "min_order_amount": "20000.00",
            "estimated_min_minutes": 30,
            "estimated_max_minutes": 45,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    restaurant.refresh_from_db()
    assert restaurant.display_name == "Nuevo Nombre"
    assert restaurant.phone == "+57 300 123 4567"
    assert restaurant.currency_code == "USD"
    assert restaurant.order_capability.delivery_enabled is False
    assert restaurant.delivery_setting.delivery_fee_amount == 5000


def test_owner_can_update_restaurant_settings_schedule(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    response = api_client.patch(
        reverse("api:owner-restaurant-settings", kwargs={"pk": restaurant.pk}),
        {
            "schedule": [
                {
                    "weekday": 0,
                    "open_time": None,
                    "close_time": None,
                    "is_closed": True,
                },
                {
                    "weekday": 2,
                    "open_time": "12:00",
                    "close_time": "20:30",
                    "is_closed": False,
                },
            ],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    monday_hours = restaurant.hours.get(weekday=0)
    wednesday_hours = restaurant.hours.get(weekday=2)
    assert monday_hours.is_closed is True
    assert monday_hours.open_time is None
    assert monday_hours.close_time is None
    assert str(wednesday_hours.open_time) == "12:00:00"
    assert str(wednesday_hours.close_time) == "20:30:00"
    monday_payload = next(
        item for item in response.data["schedule"] if item["weekday"] == 0
    )
    wednesday_payload = next(
        item for item in response.data["schedule"] if item["weekday"] == 2
    )
    assert monday_payload["is_closed"] is True
    assert monday_payload["open_time"] is None
    assert monday_payload["close_time"] is None
    assert wednesday_payload["open_time"] == "12:00:00"
    assert wednesday_payload["close_time"] == "20:30:00"


def test_owner_can_get_and_update_personalization(api_client: APIClient):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = create_restaurant_with_menu(owner=owner)
    api_client.force_authenticate(user=owner)

    get_response = api_client.get(
        reverse("api:owner-restaurant-personalization", kwargs={"pk": restaurant.pk}),
    )

    assert get_response.status_code == status.HTTP_200_OK
    assert get_response.data["menu_layout"] == "cards"

    patch_response = api_client.patch(
        reverse("api:owner-restaurant-personalization", kwargs={"pk": restaurant.pk}),
        {
            "restaurant_name": "Casa Pacifica",
            "slogan": "Sabor del mar",
            "primary_color": "#2563eb",
            "menu_layout": "grid",
            "image_size": "large",
            "show_descriptions": False,
            "search_enabled": False,
            "instagram_url": "@casa_pacifica",
        },
        format="json",
    )

    assert patch_response.status_code == status.HTTP_200_OK
    restaurant.refresh_from_db()
    assert restaurant.display_name == "Casa Pacifica"
    assert restaurant.branding.slogan == "Sabor del mar"
    assert restaurant.branding.primary_color == "#2563eb"
    assert restaurant.branding.menu_layout_option.code == "grid"
    assert restaurant.social_links.instagram_url == "@casa_pacifica"
