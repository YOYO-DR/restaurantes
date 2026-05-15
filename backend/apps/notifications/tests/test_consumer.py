import uuid

import pytest
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.menu.models import InventoryItem
from apps.menu.models import InventoryMovementType
from apps.menu.models import UnitType
from apps.orders.models import OrderStatus
from apps.orders.models import OrderType
from apps.restaurants.models import Operador
from apps.restaurants.models import OperatorPermission
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
def create_owner_with_restaurant():
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner)
    return owner, restaurant


@database_sync_to_async
def create_operator_with_permissions(restaurant, permissions: dict[str, bool]):
    operator_user = UserFactory()
    assign_role(operator_user, "operador")
    assign_role(operator_user, "cliente")
    operator = Operador.objects.create(user=operator_user, restaurante=restaurant)
    for module, can_view in permissions.items():
        OperatorPermission.objects.create(
            operator=operator,
            module=module,
            can_view=can_view,
        )
    return operator_user


@database_sync_to_async
def revoke_operator_module_permission(user_id, module: str):
    operator = Operador.objects.get(user_id=user_id)
    permission = operator.permissions.get(module=module)
    permission.can_view = False
    permission.save(update_fields=["can_view", "updated_at"])
    cache.delete(f"notifications:operator_permissions:{user_id}")


@database_sync_to_async
def create_guest_order():
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner)
    from apps.orders.models import Order

    order_type, _ = OrderType.objects.get_or_create(code="pickup", defaults={"name": "Pickup"})
    status, _ = OrderStatus.objects.get_or_create(code="new", defaults={"name": "Nuevo"})
    tracking_code = uuid.uuid4()
    order = Order.objects.create(
        order_code=f"ORD-{uuid.uuid4().hex[:6].upper()}",
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount="10000.00",
        total_amount="10000.00",
        guest_tracking_code=tracking_code,
    )
    return order


@database_sync_to_async
def create_inventory_movement_for_restaurant(restaurant):
    unit, _ = UnitType.objects.get_or_create(code="kg", defaults={"name": "Kilogramo"})
    movement_type, _ = InventoryMovementType.objects.get_or_create(
        code="stock_out",
        defaults={"name": "Salida"},
    )
    item = InventoryItem.objects.create(
        restaurant=restaurant,
        unit_type=unit,
        sku=f"SKU-{uuid.uuid4().hex[:6]}",
        name="Tomate",
        current_stock="2.000",
        min_stock="2.000",
    )
    item.current_stock = "1.000"
    item.save(update_fields=["current_stock", "updated_at"])
    return item.movements.create(
        movement_type=movement_type,
        quantity="1.000",
    )


async def test_consumer_rejects_unauthenticated():
    communicator = WebsocketCommunicator(application, "/api/ws/notifications/?active_role=cliente")
    connected, _ = await communicator.connect()
    assert connected is False


async def test_owner_joins_all_module_groups():
    owner, restaurant = await create_owner_with_restaurant()
    token = await build_access_token(owner)
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=restaurante",
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        f"r-{restaurant.id}-pedidos",
        {
            "type": "realtime.event",
            "event": {
                "event_type": "order.created",
                "module": "pedidos",
                "payload": {"order_code": "ORD-1234"},
            },
        },
    )
    message = await communicator.receive_json_from(timeout=1)
    assert message["event_type"] == "order.created"
    await communicator.disconnect()


async def test_operator_joins_only_permitted_modules():
    owner, restaurant = await create_owner_with_restaurant()
    operator_user = await create_operator_with_permissions(
        restaurant,
        {"pedidos": True, "inventario": False},
    )
    token = await build_access_token(operator_user)

    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=operador",
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        f"r-{restaurant.id}-inventario",
        {
            "type": "realtime.event",
            "event": {
                "event_type": "inventory.low_stock",
                "module": "inventario",
                "payload": {"inventory_item_name": "Tomate"},
            },
        },
    )

    assert await communicator.receive_nothing(timeout=0.3)

    await channel_layer.group_send(
        f"r-{restaurant.id}-pedidos",
        {
            "type": "realtime.event",
            "event": {
                "event_type": "order.created",
                "module": "pedidos",
                "payload": {"order_code": "ORD-8888"},
            },
        },
    )
    message = await communicator.receive_json_from(timeout=1)
    assert message["event_type"] == "order.created"
    await communicator.disconnect()


async def test_operator_message_dropped_after_permission_revoked():
    owner, restaurant = await create_owner_with_restaurant()
    operator_user = await create_operator_with_permissions(restaurant, {"pedidos": True})
    token = await build_access_token(operator_user)

    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=operador",
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    channel_layer = get_channel_layer()
    event = {
        "type": "realtime.event",
        "event": {
            "event_type": "order.created",
            "module": "pedidos",
            "payload": {"order_code": "ORD-A"},
        },
    }
    await channel_layer.group_send(f"r-{restaurant.id}-pedidos", event)
    first = await communicator.receive_json_from(timeout=1)
    assert first["payload"]["order_code"] == "ORD-A"

    await revoke_operator_module_permission(operator_user.id, "pedidos")

    event["event"]["payload"] = {"order_code": "ORD-B"}
    await channel_layer.group_send(f"r-{restaurant.id}-pedidos", event)

    assert await communicator.receive_nothing(timeout=0.3)

    await communicator.disconnect()


async def test_guest_consumer_rejects_wrong_tracking_code():
    order = await create_guest_order()
    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/guest-orders/{order.id}/?tracking_code=wrong",
    )
    connected, _ = await communicator.connect()
    assert connected is False


async def test_role_switch_rejoins_groups():
    owner, restaurant = await create_owner_with_restaurant()
    operator_user = await create_operator_with_permissions(restaurant, {"pedidos": True})
    token = await build_access_token(operator_user)

    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=cliente",
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    await communicator.send_json_to({"type": "switch_role", "role": "operador"})
    switched = await communicator.receive_json_from(timeout=1)
    assert switched["type"] == "session.role_switched"

    channel_layer = get_channel_layer()
    await channel_layer.group_send(
        f"r-{restaurant.id}-pedidos",
        {
            "type": "realtime.event",
            "event": {
                "event_type": "order.created",
                "module": "pedidos",
                "payload": {"order_code": "ORD-SWITCH"},
            },
        },
    )
    message = await communicator.receive_json_from(timeout=1)
    assert message["payload"]["order_code"] == "ORD-SWITCH"
    await communicator.disconnect()


async def test_low_stock_signal_fires_inventario_group():
    owner, restaurant = await create_owner_with_restaurant()
    token = await build_access_token(owner)

    communicator = WebsocketCommunicator(
        application,
        f"/api/ws/notifications/?access_token={token}&active_role=restaurante",
    )
    connected, _ = await communicator.connect()
    assert connected is True
    await communicator.receive_json_from(timeout=1)

    await create_inventory_movement_for_restaurant(restaurant)

    message = await communicator.receive_json_from(timeout=1)
    assert message["event_type"] in {"inventory.movement", "inventory.low_stock"}
    await communicator.disconnect()
