import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Role
from apps.accounts.models import UserRole
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


async def test_owner_websocket_rejects_different_owner_id():
    owner = await create_user_with_role("restaurante")
    other_owner = await create_user_with_role()

    token = await build_access_token(owner)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{other_owner.id}/?access_token={token}",
    )

    connected, _subprotocol = await communicator.connect()

    assert connected is False


async def test_owner_websocket_accepts_matching_owner_id():
    owner = await create_user_with_role("restaurante")

    token = await build_access_token(owner)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{owner.id}/?access_token={token}",
    )

    connected, _subprotocol = await communicator.connect()

    assert connected is True
    await communicator.disconnect()


async def test_user_websocket_rejects_other_user_id():
    user = await create_user_with_role()
    other_user = await create_user_with_role()

    token = await build_access_token(user)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/user-orders/{other_user.id}/?access_token={token}",
    )

    connected, _subprotocol = await communicator.connect()

    assert connected is False


async def test_admin_can_connect_owner_websocket_for_any_restaurant_owner():
    admin_user = await create_user_with_role("admin")
    owner = await create_user_with_role()

    token = await build_access_token(admin_user)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/orders/{owner.id}/?access_token={token}",
    )

    connected, _subprotocol = await communicator.connect()

    assert connected is True
    await communicator.disconnect()
