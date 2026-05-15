import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.orders.models import Order
from apps.orders.models import OrderStatus
from apps.orders.models import OrderType
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory
from config.asgi import application

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.anyio]


def assign_role(user, code: str):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


@database_sync_to_async
def build_access_token(user) -> str:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token)


@database_sync_to_async
def create_user_with_role(code: str | None = None):
    user = UserFactory()
    if code:
        assign_role(user, code)
    return user


async def test_session_notifications_accepts_owner_role():
    owner = await create_user_with_role("restaurante")

    token = await build_access_token(owner)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=restaurante",
    )

    connected, _subprotocol = await communicator.connect()
    assert connected is True
    await communicator.disconnect()


async def test_session_notifications_accepts_owner_role_without_path_ids():
    owner = await create_user_with_role("restaurante")

    token = await build_access_token(owner)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=restaurante",
    )

    connected, _subprotocol = await communicator.connect()

    assert connected is True
    await communicator.disconnect()


async def test_session_notifications_accepts_client_role_without_path_ids():
    user = await create_user_with_role()

    token = await build_access_token(user)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=cliente",
    )

    connected, _subprotocol = await communicator.connect()
    assert connected is True
    await communicator.disconnect()


async def test_session_notifications_accepts_admin_role():
    admin_user = await create_user_with_role("admin")

    token = await build_access_token(admin_user)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=admin",
    )

    connected, _subprotocol = await communicator.connect()

    assert connected is True
    await communicator.disconnect()


@database_sync_to_async
def create_guest_order_with_tracking():
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner)
    order_type, _ = OrderType.objects.get_or_create(code="pickup", defaults={"name": "Pickup"})
    status, _ = OrderStatus.objects.get_or_create(code="new", defaults={"name": "Nuevo"})
    order = Order.objects.create(
        order_code="ORD-WS-001",
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount="10000.00",
        total_amount="10000.00",
    )
    from apps.orders.services import build_guest_tracking_code

    order.guest_tracking_code = build_guest_tracking_code()
    order.save(update_fields=["guest_tracking_code", "updated_at"])
    return order


async def test_guest_websocket_rejects_without_tracking_code():
    order = await create_guest_order_with_tracking()
    communicator = WebsocketCommunicator(application, f"/api/ws/guest-orders/{order.id}/")
    connected, _subprotocol = await communicator.connect()
    assert connected is False


async def test_guest_websocket_accepts_valid_tracking_code():
    order = await create_guest_order_with_tracking()
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/guest-orders/{order.id}/?tracking_code={order.guest_tracking_code}",
    )
    connected, _subprotocol = await communicator.connect()
    assert connected is True
    await communicator.disconnect()
