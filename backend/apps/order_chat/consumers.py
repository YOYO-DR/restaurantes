from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.notifications.permissions import is_operator_session_active
from apps.order_chat.permissions import has_order_chat_access
from apps.order_chat.permissions import is_restaurant_member
from apps.order_chat.permissions import order_chat_group
from apps.order_chat.services import assert_typing_rate_limit


class OrderChatConsumer(AsyncJsonWebsocketConsumer):
    heartbeat_interval_seconds = 25
    activity_check_counter = 0
    _order = None
    _is_restaurant_side = False

    async def connect(self):
        order_id = self.scope["url_route"]["kwargs"].get("order_id")
        if not order_id:
            await self.close(code=4001)
            return

        self.order_id = order_id
        self.user = self.scope.get("user")
        self.tracking_code = self._query_param("tracking_code")

        allowed, order, is_restaurant_side = await self._resolve_access(
            order_id,
            self.user,
            self.tracking_code,
        )
        if not allowed:
            await self.close(code=4003)
            return

        self._order = order
        self._is_restaurant_side = is_restaurant_side
        self.group_name = order_chat_group(order_id)

        chat = await self._get_or_create_chat(order)
        if chat.is_closed:
            await self.accept()
            await self.send_json({"type": "chat.closed"})
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({"type": "chat.ready", "messages": await self._latest_messages(chat.id)})

    async def disconnect(self, code):
        if getattr(self, "group_name", ""):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if bytes_data is not None:
            await self.close(code=4007)
            return
        await super().receive(text_data=text_data, bytes_data=bytes_data)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})
            return

        if message_type == "typing":
            actor_key = self._actor_key()
            if not assert_typing_rate_limit(actor_key, self.order_id):
                return
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "chat_event",
                    "event": {
                        "event_type": "chat.typing",
                        "payload": {
                            "actor": "restaurant" if self._is_restaurant_side else "customer",
                        },
                    },
                },
            )

    async def chat_event(self, event):
        payload = event.get("event") or {}
        if not payload:
            return

        if self._is_restaurant_side and self.user.is_authenticated:
            is_operator = await database_sync_to_async(self._is_operator)(self.user.id)
            if is_operator:
                is_active = await database_sync_to_async(is_operator_session_active)(self.user.id)
                if not is_active:
                    await self.send_json({"type": "session_revoked"})
                    await self.close(code=4003)
                    return

        self.activity_check_counter += 1
        if self.activity_check_counter >= 50:
            self.activity_check_counter = 0
            if self.user and self.user.is_authenticated:
                is_user_active = await database_sync_to_async(self._is_user_active)(self.user.id)
                if not is_user_active:
                    await self.close(code=4001)
                    return

        await self.send_json(
            {
                "event_type": payload.get("event_type"),
                "payload": payload.get("payload", {}),
            },
        )

    def _query_param(self, key: str) -> str:
        query = parse_qs(self.scope.get("query_string", b"").decode())
        return (query.get(key) or [""])[0]

    @database_sync_to_async
    def _resolve_access(self, order_id, user, tracking_code):
        from apps.orders.models import Order

        order = (
            Order.objects.select_related("chat", "restaurant")
            .filter(id=order_id)
            .first()
        )
        if not order:
            return False, None, False

        allowed = has_order_chat_access(order, user, tracking_code)
        is_restaurant_side = bool(
            user
            and user.is_authenticated
            and user.id != order.user_id
            and is_restaurant_member(user, order.restaurant_id)
        )
        return allowed, order, is_restaurant_side

    @database_sync_to_async
    def _get_or_create_chat(self, order):
        from apps.order_chat.models import OrderChat

        chat = getattr(order, "chat", None)
        if chat is not None:
            return chat
        return OrderChat.objects.create(order=order)

    @database_sync_to_async
    def _latest_messages(self, chat_id):
        from apps.order_chat.models import OrderChatMessage
        from apps.order_chat.services import message_payload

        messages = OrderChatMessage.objects.filter(chat_id=chat_id).order_by("-created_at")[:50]
        ordered = list(reversed(list(messages)))
        return [message_payload(item) for item in ordered]

    def _actor_key(self) -> str:
        if self.user and self.user.is_authenticated:
            return f"user:{self.user.id}"
        return f"guest:{self.tracking_code}"

    @staticmethod
    def _is_operator(user_id) -> bool:
        from apps.restaurants.models import Operador

        return Operador.objects.filter(user_id=user_id).exists()

    @staticmethod
    def _is_user_active(user_id) -> bool:
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.filter(id=user_id).only("is_active").first()
        return bool(user and user.is_active)
