import pytest
from django.core import mail
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.orders.models import Order
from apps.restaurants.models import Operador
from apps.restaurants.models import TableStatus
from apps.restaurants.tests.factories import AddressTypeFactory
from apps.restaurants.tests.factories import CustomerAddressFactory
from apps.restaurants.tests.factories import MenuCategoryFactory
from apps.restaurants.tests.factories import MenuItemFactory
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantAddressFactory
from apps.restaurants.tests.factories import RestaurantDeliverySettingFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.restaurants.tests.factories import RestaurantOrderCapabilityFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    cache.clear()
    return APIClient()


def assign_role(user, code: str):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def setup_checkout_data(user):
    AddressTypeFactory(code="home", name="Casa")
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderTypeFactory(code="pickup", name="Pickup")
    OrderTypeFactory(code="table", name="Mesa")
    OrderStatusFactory(code="new", name="Nuevo")
    OrderStatusFactory(code="preparing", name="Preparando")
    OrderStatusFactory(code="ready", name="Listo")
    OrderStatusFactory(code="delivered", name="Entregado")
    OrderStatusFactory(code="cancelled", name="Cancelado")

    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(restaurant=restaurant, table_order_enabled=True)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(
        restaurant=restaurant,
        slug="entradas",
        name="Entradas",
    )
    item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        slug="empanadas",
        name="Empanadas",
        price_amount="12000.00",
    )
    address = CustomerAddressFactory(user=user)
    return restaurant, item, address


def test_customer_can_checkout_delivery_order(api_client: APIClient):
    user = UserFactory()
    restaurant, item, address = setup_checkout_data(user)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 2}],
            "customer_notes": "Sin picante",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["order_type_code"] == "delivery"
    assert response.data["status_code"] == "new"
    assert response.data["total_amount"] == "27000.00"
    assert Order.objects.count() == 1


def test_customer_can_checkout_table_order_without_service_fee(api_client: APIClient):
    user = UserFactory()
    restaurant, item, _address = setup_checkout_data(user)
    active_status, _ = TableStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activa"},
    )
    active_table = restaurant.tables.create(
        table_number="4",
        capacity=4,
        status=active_status,
    )
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "table",
            "table_id": str(active_table.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 2}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["order_type_code"] == "table"
    assert response.data["service_fee_amount"] == "0.00"
    assert response.data["total_amount"] == "24000.00"


def test_guest_can_checkout_pickup_order_and_receives_email(api_client: APIClient):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderTypeFactory(code="pickup", name="Pickup")
    OrderTypeFactory(code="table", name="Mesa")
    OrderStatusFactory(code="new", name="Nuevo")
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=True,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(
        restaurant=restaurant,
        slug="almuerzos",
        name="Almuerzos",
    )
    item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        slug="bandeja-paisa",
        name="Bandeja paisa",
        price_amount="22000.00",
    )

    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "pickup",
            "customer_name": "Invitado Demo",
            "customer_email": "guest@example.com",
            "customer_phone": "3001234567",
            "customer_notes": "Sin salsa",
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["customer_email"] == "guest@example.com"
    assert response.data["customer_phone"] == "3001234567"
    assert response.data["guest_tracking_code"]
    assert Order.objects.get(id=response.data["id"]).user is None
    assert len(mail.outbox) == 1


def test_guest_checkout_requires_contact_for_delivery(api_client: APIClient):
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=False,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)

    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_text": "Calle 10 #11-22",
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "customer_email" in response.data


def test_guest_can_checkout_table_order_without_contact_info(api_client: APIClient):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderTypeFactory(code="pickup", name="Pickup")
    OrderTypeFactory(code="table", name="Mesa")
    OrderStatusFactory(code="new", name="Nuevo")
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=True,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)
    active_status, _ = TableStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activa"},
    )
    active_table = restaurant.tables.create(
        table_number="8",
        capacity=4,
        status=active_status,
    )

    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "table",
            "delivery_address_id": None,
            "delivery_address_text": None,
            "table_id": str(active_table.id),
            "customer_name": "",
            "customer_email": "",
            "customer_phone": "",
            "customer_notes": "sin cebolla",
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["order_type_code"] == "table"
    assert response.data["guest_tracking_code"]
    order = Order.objects.get(id=response.data["id"])
    assert order.user is None
    assert order.customer_email == ""
    assert order.customer_phone == ""


def test_guest_can_view_public_order_status_without_auth(api_client: APIClient):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderTypeFactory(code="pickup", name="Pickup")
    OrderTypeFactory(code="table", name="Mesa")
    OrderStatusFactory(code="new", name="Nuevo")
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=True,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)
    active_status, _ = TableStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activa"},
    )
    active_table = restaurant.tables.create(
        table_number="9",
        capacity=4,
        status=active_status,
    )

    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "table",
            "table_id": str(active_table.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    response = api_client.get(
        reverse("api:checkout-order-status", kwargs={"pk": create_response.data["id"]}),
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == create_response.data["id"]


def test_authenticated_order_status_is_only_visible_to_owner(api_client: APIClient):
    user = UserFactory()
    other_user = UserFactory()
    restaurant, item, address = setup_checkout_data(user)

    api_client.force_authenticate(user=user)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=None)
    unauthenticated_response = api_client.get(
        reverse("api:checkout-order-status", kwargs={"pk": create_response.data["id"]}),
    )
    assert unauthenticated_response.status_code == status.HTTP_403_FORBIDDEN

    api_client.force_authenticate(user=other_user)
    foreign_user_response = api_client.get(
        reverse("api:checkout-order-status", kwargs={"pk": create_response.data["id"]}),
    )
    assert foreign_user_response.status_code == status.HTTP_403_FORBIDDEN

    api_client.force_authenticate(user=user)
    owner_response = api_client.get(
        reverse("api:checkout-order-status", kwargs={"pk": create_response.data["id"]}),
    )
    assert owner_response.status_code == status.HTTP_200_OK
    assert owner_response.data["id"] == create_response.data["id"]


def test_guest_can_cancel_public_order(api_client: APIClient):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderTypeFactory(code="pickup", name="Pickup")
    OrderTypeFactory(code="table", name="Mesa")
    OrderStatusFactory(code="new", name="Nuevo")
    OrderStatusFactory(code="cancelled", name="Cancelado")
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=True,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)
    active_status, _ = TableStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activa"},
    )
    active_table = restaurant.tables.create(
        table_number="5",
        capacity=4,
        status=active_status,
    )

    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "table",
            "table_id": str(active_table.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    response = api_client.patch(
        reverse("api:checkout-order-cancel", kwargs={"pk": create_response.data["id"]}),
        {"reason": "Ya no lo necesito"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status_code"] == "cancelled"


def test_owner_can_cancel_order(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant, item, address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.patch(
        reverse("api:owner-order-cancel", kwargs={"pk": create_response.data["id"]}),
        {"reason": "Sin inventario"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status_code"] == "cancelled"


def test_checkout_returns_validation_error_when_order_type_catalog_is_missing(
    api_client: APIClient,
):
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=True,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)
    OrderStatusFactory(code="new", name="Nuevo")
    active_status, _ = TableStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activa"},
    )
    active_table = restaurant.tables.create(
        table_number="10",
        capacity=4,
        status=active_status,
    )
    Order.objects.all().delete()
    from apps.orders.models import OrderType

    OrderType.objects.filter(code="table").delete()

    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "table",
            "table_id": str(active_table.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "order_type" in response.data


def test_checkout_returns_validation_error_when_new_status_catalog_is_missing(
    api_client: APIClient,
):
    user = UserFactory()
    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(
        restaurant=restaurant,
        delivery_enabled=True,
        pickup_enabled=True,
        table_order_enabled=True,
    )
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)
    address = CustomerAddressFactory(user=user)
    OrderTypeFactory(code="delivery", name="Delivery")
    from apps.orders.models import OrderStatus

    OrderStatus.objects.filter(code="new").delete()

    api_client.force_authenticate(user=user)
    response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "detail" in response.data


def test_customer_can_list_own_orders(api_client: APIClient):
    user = UserFactory()
    restaurant, item, address = setup_checkout_data(user)
    api_client.force_authenticate(user=user)
    api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    response = api_client.get(reverse("api:customer-order-list"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1


def test_owner_can_list_restaurant_orders(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant, item, address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])

    api_client.force_authenticate(user=customer)
    api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.get(reverse("api:owner-order-list"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1


def test_owner_can_update_order_status(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant, item, address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": create_response.data["id"]}),
        {"status_code": "preparing"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status_code"] == "preparing"


def test_operator_can_list_orders_for_assigned_restaurant(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    operator = UserFactory()
    assign_role(owner, "restaurante")
    assign_role(operator, "operador")
    restaurant, item, address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])
    Operador.objects.create(user=operator, restaurante=restaurant)

    api_client.force_authenticate(user=customer)
    api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=operator)
    response = api_client.get(reverse("api:owner-order-list"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1


def test_operator_can_update_order_status_for_assigned_restaurant(
    api_client: APIClient,
):
    customer = UserFactory()
    owner = UserFactory()
    operator = UserFactory()
    assign_role(owner, "restaurante")
    assign_role(operator, "operador")
    restaurant, item, address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])
    Operador.objects.create(user=operator, restaurante=restaurant)

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    api_client.force_authenticate(user=operator)
    response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": create_response.data["id"]}),
        {"status_code": "preparing"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["status_code"] == "preparing"


def test_customer_dashboard_returns_metrics(api_client: APIClient):
    user = UserFactory()
    restaurant, item, address = setup_checkout_data(user)
    api_client.force_authenticate(user=user)
    api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "delivery",
            "delivery_address_id": str(address.id),
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    response = api_client.get(reverse("api:customer-dashboard-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_orders"] == 1
    assert len(response.data["recent_orders"]) == 1
