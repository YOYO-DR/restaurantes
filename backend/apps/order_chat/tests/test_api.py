import io

import pytest
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.order_chat.models import OrderChat
from apps.order_chat.models import OrderChatMessage
from apps.platform_config.models import PlatformSetting
from apps.restaurants.models import Operador
from apps.restaurants.models import OperatorPermission
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

from apps.orders.models import Order

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def assign_role(user, code: str):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def setup_order(customer_user=None):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderStatusFactory(code="new", name="Nuevo")
    OrderStatusFactory(code="delivered", name="Entregado")
    OrderStatusFactory(code="cancelled", name="Cancelado")

    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantHourFactory(restaurant=restaurant, weekday=1)
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category)

    order = Order.objects.create(
        order_code="ORD-9999",
        user=customer_user,
        restaurant=restaurant,
        order_type=OrderTypeFactory(code="pickup", name="Pickup"),
        status=OrderStatusFactory(code="preparing", name="Preparando"),
        subtotal_amount="10000.00",
        delivery_fee_amount="0.00",
        service_fee_amount="0.00",
        discount_amount="0.00",
        total_amount="10000.00",
        currency_code="COP",
    )
    order.items.create(
        menu_item=item,
        item_name_snapshot=item.name,
        unit_price_amount=item.price_amount,
        quantity=1,
        line_total_amount=item.price_amount,
    )
    return order


def test_contact_info_for_customer_owner(api_client: APIClient):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)
    api_client.force_authenticate(customer)

    response = api_client.get(f"/api/orders/{order.id}/contact-info/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["name"] == order.restaurant.display_name


def test_guest_access_with_tracking_code(api_client: APIClient):
    order = setup_order(None)
    order.guest_tracking_code = "0bc6ceba-5da7-4abf-a6f9-e9fe8178e988"
    order.save(update_fields=["guest_tracking_code"])

    response = api_client.get(f"/api/orders/{order.id}/chat/?tracking_code={order.guest_tracking_code}")
    assert response.status_code == status.HTTP_200_OK
    assert str(response.data["order_id"]) == str(order.id)


def test_operator_without_permission_cannot_access_chat(api_client: APIClient):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)

    operator_user = UserFactory()
    assign_role(operator_user, "operador")
    operador = Operador.objects.create(user=operator_user, restaurante=order.restaurant)
    OperatorPermission.objects.create(
        operator=operador,
        module="pedidos",
        can_view=False,
        can_create=False,
        can_edit=False,
        can_delete=False,
    )

    api_client.force_authenticate(operator_user)
    response = api_client.get(f"/api/orders/{order.id}/chat/")
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_can_post_chat_message_text(api_client: APIClient):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)
    api_client.force_authenticate(customer)

    response = api_client.post(
        f"/api/orders/{order.id}/chat/messages/",
        {"body": "Hola restaurante"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["body"] == "Hola restaurante"
    assert OrderChatMessage.objects.filter(chat__order=order).count() == 1


def test_post_chat_message_triggers_realtime_notifications_for_restaurant(api_client: APIClient, monkeypatch: pytest.MonkeyPatch):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)
    api_client.force_authenticate(customer)

    captured = {}

    def fake_notify_restaurant(*, restaurant_id, module, event_type, payload, persist=True):
        captured["restaurant_id"] = restaurant_id
        captured["module"] = module
        captured["event_type"] = event_type
        captured["payload"] = payload
        captured["persist"] = persist

    monkeypatch.setattr(
        "apps.order_chat.api.views.realtime.notify_restaurant",
        fake_notify_restaurant,
    )

    response = api_client.post(
        f"/api/orders/{order.id}/chat/messages/",
        {"body": "Hola restaurante"},
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert captured["restaurant_id"] == order.restaurant_id
    assert captured["module"] == "pedidos"
    assert captured["event_type"] == "order.chat_message"
    assert captured["persist"] is True
    assert captured["payload"]["order_code"] == order.order_code
    assert captured["payload"]["sender_kind"] == "customer"


def test_restaurant_message_notifies_customer_user(api_client: APIClient, monkeypatch: pytest.MonkeyPatch):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)

    operator_user = UserFactory()
    assign_role(operator_user, "operador")
    operador = Operador.objects.create(user=operator_user, restaurante=order.restaurant)
    OperatorPermission.objects.create(
        operator=operador,
        module="pedidos",
        can_view=True,
        can_create=False,
        can_edit=False,
        can_delete=False,
    )
    api_client.force_authenticate(operator_user)
    captured = {}

    def fake_notify_user(*, user_id, event_type, payload, persist=True):
        captured["user_id"] = user_id
        captured["event_type"] = event_type
        captured["payload"] = payload
        captured["persist"] = persist

    monkeypatch.setattr(
        "apps.order_chat.api.views.realtime.notify_user",
        fake_notify_user,
    )

    response = api_client.post(
        f"/api/orders/{order.id}/chat/messages/",
        {"body": "Tu pedido ya casi sale"},
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert captured["user_id"] == customer.id
    assert captured["event_type"] == "order.chat_message"
    assert captured["persist"] is True
    assert captured["payload"]["order_code"] == order.order_code
    assert captured["payload"]["sender_kind"] == "restaurant"


def test_chat_image_blocked_when_disabled(api_client: APIClient):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)
    PlatformSetting.objects.create(platform_name="FoodHub", chat_images_enabled=False)
    api_client.force_authenticate(customer)

    image_data = io.BytesIO()
    img = Image.new("RGB", (10, 10), color="red")
    img.save(image_data, format="PNG")
    image_data.seek(0)
    upload = SimpleUploadedFile("test.png", image_data.read(), content_type="image/png")

    response = api_client.post(
        f"/api/orders/{order.id}/chat/messages/",
        {"body": "", "image": upload},
        format="multipart",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.data["code"] == "images_disabled"


def test_read_endpoint_marks_messages(api_client: APIClient):
    customer = UserFactory()
    assign_role(customer, "cliente")
    order = setup_order(customer)
    chat = OrderChat.objects.get(order=order)
    OrderChatMessage.objects.create(
        chat=chat,
        sender_kind=OrderChatMessage.SenderKind.RESTAURANT,
        sender_label="Restaurante",
        body="Tu pedido va en camino",
    )

    api_client.force_authenticate(customer)
    response = api_client.post(f"/api/orders/{order.id}/chat/read/", {})
    assert response.status_code == status.HTTP_200_OK
    assert response.data["updated"] == 1


def test_platform_chat_config_public(api_client: APIClient):
    PlatformSetting.objects.create(
        platform_name="FoodHub",
        chat_images_enabled=True,
        chat_image_max_mb=8,
        chat_image_allowed_mimes="image/jpeg,image/png",
        chat_post_close_purge_hours=24,
    )

    response = api_client.get("/api/platform/chat-config/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["chat_image_max_mb"] == 8
