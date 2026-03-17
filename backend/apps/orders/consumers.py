from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.orders.services import build_guest_order_group_name
from apps.orders.services import build_owner_order_group_name
from apps.orders.services import build_user_order_group_name


class BaseOrderConsumer(AsyncJsonWebsocketConsumer):
    event_type = "order.updated"
    group_name = ""

    async def disconnect(self, code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def broadcast_message(self, event):
        await self.send_json(
            {
                "type": self.event_type,
                "payload": event["payload"],
            }
        )


class OwnerOrderConsumer(BaseOrderConsumer):
    event_type = "owner.order.created"

    async def connect(self):
        owner_id = self.scope["url_route"]["kwargs"].get("owner_id")
        if not owner_id:
            await self.close(code=4001)
            return

        self.group_name = build_owner_order_group_name(owner_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def owner_order_created(self, event):
        await self.broadcast_message(event)

    async def owner_order_updated(self, event):
        await self.send_json(
            {
                "type": "owner.order.updated",
                "payload": event["payload"],
            }
        )


class UserOrderConsumer(BaseOrderConsumer):
    event_type = "user.order.updated"

    async def connect(self):
        user = self.scope.get("user")
        user_id = self.scope["url_route"]["kwargs"].get("user_id")
        if not user or not user.is_authenticated or str(user.id) != user_id:
            await self.close(code=4003)
            return

        self.group_name = build_user_order_group_name(user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def user_order_updated(self, event):
        await self.broadcast_message(event)


class GuestOrderConsumer(BaseOrderConsumer):
    event_type = "guest.order.updated"

    async def connect(self):
        order_id = self.scope["url_route"]["kwargs"].get("order_id")
        if not order_id:
            await self.close(code=4001)
            return

        self.group_name = build_guest_order_group_name(order_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def guest_order_updated(self, event):
        await self.broadcast_message(event)
