from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.notifications.permissions import can_user_receive_module
from apps.notifications.permissions import groups_for_user
from apps.notifications.permissions import is_operator_session_active


class SessionNotificationsConsumer(AsyncJsonWebsocketConsumer):
    heartbeat_interval_seconds = 25
    activity_check_counter = 0

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        requested_role = self._query_param("active_role")
        resolution = await database_sync_to_async(groups_for_user)(user, requested_role)
        self.active_role = resolution.role
        self._groups = set(resolution.groups)

        for group in self._groups:
            await self.channel_layer.group_add(group, self.channel_name)

        await self.accept()
        await self.send_json(
            {
                "type": "session.ready",
                "active_role": self.active_role,
            },
        )

    async def disconnect(self, code):
        for group in getattr(self, "_groups", set()):
            await self.channel_layer.group_discard(group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get("type")
        if message_type == "ping":
            await self.send_json({"type": "pong"})
            return

        if message_type == "switch_role":
            await self._switch_role(content.get("role") or "")

    async def _switch_role(self, role: str) -> None:
        user = self.scope.get("user")
        resolution = await database_sync_to_async(groups_for_user)(user, role)
        next_groups = set(resolution.groups)

        for group in self._groups - next_groups:
            await self.channel_layer.group_discard(group, self.channel_name)

        for group in next_groups - self._groups:
            await self.channel_layer.group_add(group, self.channel_name)

        self._groups = next_groups
        self.active_role = resolution.role
        await self.send_json({"type": "session.role_switched", "active_role": self.active_role})

    async def realtime_event(self, event):
        payload = event.get("event") or {}
        module = payload.get("module")
        user = self.scope.get("user")

        if module and module not in {"personal", "guest_order"}:
            allowed = await database_sync_to_async(can_user_receive_module)(
                user,
                module,
                self.active_role,
            )
            if not allowed:
                return

            if self.active_role == "operador":
                is_active = await database_sync_to_async(is_operator_session_active)(user.id)
                if not is_active:
                    await self.send_json({"type": "session_revoked"})
                    await self.close(code=4003)
                    return

        self.activity_check_counter += 1
        if self.activity_check_counter >= 50:
            self.activity_check_counter = 0
            if not await database_sync_to_async(self._is_user_active)(user.id):
                await self.send_json({"type": "session_revoked"})
                await self.close(code=4003)
                return

        await self.send_json(payload)

    def _query_param(self, key: str) -> str:
        query = parse_qs(self.scope.get("query_string", b"").decode())
        return (query.get(key) or [""])[0]

    @staticmethod
    def _is_user_active(user_id) -> bool:
        from django.contrib.auth import get_user_model

        user = get_user_model().objects.filter(id=user_id).only("is_active").first()
        return bool(user and user.is_active)
