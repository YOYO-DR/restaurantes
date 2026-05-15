import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.order_chat.models import OrderChat
from apps.order_chat.models import OrderChatMessage
from apps.order_chat.permissions import order_chat_group
from apps.restaurants.models import Operador
from apps.restaurants.models import OperatorPermission
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory
from config.asgi import application

from apps.orders.models import Order

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.anyio]

WS_HEADERS = [(b"origin", b"http://testserver"), (b"host", b"testserver")]


def assign_role(user, code: str):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


@database_sync_to_async
def build_access_token(user) -> str:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


@database_sync_to_async
def create_chat_order(customer_user=None):
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner)
    order_type = OrderTypeFactory(code="pickup", name="Pickup")
    status = OrderStatusFactory(code="preparing", name="Preparando")
    order = Order.objects.create(
        order_code="ORD-CHAT-WS",
        user=customer_user,
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount="10000.00",
        delivery_fee_amount="0.00",
        service_fee_amount="0.00",
        discount_amount="0.00",
        total_amount="10000.00",
        currency_code="COP",
        guest_tracking_code="5f9b7788-6d2c-4c9f-9942-e0cd6f3f15dc" if customer_user is None else None,
    )
    chat, _ = OrderChat.objects.get_or_create(order=order)
    return order, chat


@database_sync_to_async
def create_customer_message(chat_id):
    return OrderChatMessage.objects.create(
        chat_id=chat_id,
        sender_kind=OrderChatMessage.SenderKind.CUSTOMER,
        sender_label="Cliente",
        body="Hola",
    )


@database_sync_to_async
def create_operator_for_order(order):
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
    return operator_user


async def test_order_chat_ws_rejects_unauthorized_user():
    customer = await create_user_with_role("cliente")
    order, _chat = await create_chat_order(customer)

    stranger = await create_user_with_role("cliente")
    token = await build_access_token(stranger)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{order.id}/chat/?access_token={token}",
        headers=WS_HEADERS,
    )

    connected, _ = await communicator.connect()
    assert connected is False


async def test_order_chat_ws_sends_initial_snapshot():
    customer = await create_user_with_role("cliente")
    order, chat = await create_chat_order(customer)
    await create_customer_message(chat.id)

    token = await build_access_token(customer)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{order.id}/chat/?access_token={token}",
        headers=WS_HEADERS,
    )

    connected, _ = await communicator.connect()
    assert connected is True
    ready = await communicator.receive_json_from(timeout=1)
    assert ready["type"] == "chat.ready"
    assert len(ready["messages"]) == 1
    await communicator.disconnect()


async def test_order_chat_ws_relays_chat_event():
    customer = await create_user_with_role("cliente")
    order, _chat = await create_chat_order(customer)
    token = await build_access_token(customer)

    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{order.id}/chat/?access_token={token}",
        headers=WS_HEADERS,
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        order_chat_group(order.id),
        {
            "type": "chat_event",
            "event": {
                "event_type": "chat.message",
                "payload": {"id": "msg-1", "body": "Hola"},
            },
        },
    )

    message = await communicator.receive_json_from(timeout=1)
    assert message["event_type"] == "chat.message"
    assert message["payload"]["body"] == "Hola"
    await communicator.disconnect()


async def test_order_chat_ws_accepts_guest_with_tracking_code():
    order, _chat = await create_chat_order(None)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{order.id}/chat/?tracking_code={order.guest_tracking_code}",
        headers=WS_HEADERS,
    )
    connected, _ = await communicator.connect()
    assert connected is True
    ready = await communicator.receive_json_from(timeout=1)
    assert ready["type"] == "chat.ready"
    await communicator.disconnect()


async def test_order_chat_ws_closes_operator_when_session_revoked(monkeypatch):
    customer = await create_user_with_role("cliente")
    order, _chat = await create_chat_order(customer)
    operator_user = await create_operator_for_order(order)
    token = await build_access_token(operator_user)

    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{order.id}/chat/?access_token={token}",
        headers=WS_HEADERS,
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    monkeypatch.setattr("apps.order_chat.consumers.is_operator_session_active", lambda user_id: False)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        order_chat_group(order.id),
        {
            "type": "chat_event",
            "event": {
                "event_type": "chat.message",
                "payload": {"id": "msg-2", "body": "Hola"},
            },
        },
    )

    revoked = await communicator.receive_json_from(timeout=1)
    assert revoked["type"] == "session_revoked"


@database_sync_to_async
def create_user_with_role(code: str | None = None):
    user = UserFactory()
    if code:
        assign_role(user, code)
    return user
