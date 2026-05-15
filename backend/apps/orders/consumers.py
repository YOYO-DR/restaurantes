from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.notifications.permissions import guest_order_group


class BaseOrderConsumer(AsyncJsonWebsocketConsumer):
    group_name = ""

    async def disconnect(self, code):
        if self.group_name:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"type": "pong"})

    async def broadcast_message(self, event):
        payload = event.get("event", {}).get("payload")
        event_type = event.get("event", {}).get("event_type")
        if payload is None or not event_type:
            return
        await self.send_json(
            {
                "event_type": event_type,
                "payload": payload,
            },
        )


class GuestOrderConsumer(BaseOrderConsumer):
    async def connect(self):
        order_id = self.scope["url_route"]["kwargs"].get("order_id")
        tracking_code = self._query_param("tracking_code")
        if not order_id or not tracking_code:
            await self.close(code=4001)
            return

        is_valid = await self._validate_guest_access(order_id, tracking_code)
        if not is_valid:
            await self.close(code=4003)
            return

        self.group_name = guest_order_group(order_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def realtime_event(self, event):
        await self.broadcast_message(event)

    def _query_param(self, key: str) -> str:
        from urllib.parse import parse_qs

        query = parse_qs(self.scope.get("query_string", b"").decode())
        return (query.get(key) or [""])[0]

    @staticmethod
    async def _validate_guest_access(order_id, tracking_code: str) -> bool:
        import uuid

        from channels.db import database_sync_to_async

        try:
            parsed_tracking_code = uuid.UUID(str(tracking_code))
        except (ValueError, TypeError):
            return False

        @database_sync_to_async
        def _query():
            from apps.orders.models import Order

            return Order.objects.filter(
                id=order_id,
                user__isnull=True,
                guest_tracking_code=parsed_tracking_code,
            ).exists()

        return await _query()
