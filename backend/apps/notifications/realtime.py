from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from apps.notifications.models import NotificationEvent
from apps.notifications.models import NotificationType
from apps.notifications.permissions import guest_order_group
from apps.notifications.permissions import restaurant_group
from apps.notifications.permissions import user_group


def _send_group_event(group_name: str, event: dict[str, object]) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "realtime.event",
            "event": event,
        },
    )


def _ensure_notification_type(event_type: str, audience_role_code: str = "cliente") -> NotificationType:
    from apps.accounts.models import Role

    role, _ = Role.objects.get_or_create(
        code=audience_role_code,
        defaults={"name": audience_role_code.title()},
    )
    notification_type, _ = NotificationType.objects.get_or_create(
        code=event_type.replace(".", "_"),
        defaults={
            "name": event_type.replace(".", " ").title(),
            "audience_role": role,
            "description": f"Evento realtime {event_type}",
        },
    )
    return notification_type


def _persist_event(user_id, event_type: str, payload: dict[str, object], audience_role_code: str) -> None:
    notification_type = _ensure_notification_type(event_type, audience_role_code)
    NotificationEvent.objects.create(
        user_id=user_id,
        notification_type=notification_type,
        payload_json={
            "event_type": event_type,
            **payload,
        },
        sent_at=timezone.now(),
    )


def notify_restaurant(
    restaurant_id,
    module: str,
    event_type: str,
    payload: dict[str, object],
    persist: bool = True,
) -> None:
    event = {
        "event_type": event_type,
        "module": module,
        "payload": payload,
    }
    _send_group_event(restaurant_group(restaurant_id, module), event)

    if not persist:
        return

    from apps.restaurants.models import Restaurant

    owner_id = (
        Restaurant.objects.filter(id=restaurant_id).values_list("owner_id", flat=True).first()
    )
    if owner_id:
        _persist_event(owner_id, event_type, payload, audience_role_code="restaurante")


def notify_user(
    user_id,
    event_type: str,
    payload: dict[str, object],
    persist: bool = True,
) -> None:
    event = {
        "event_type": event_type,
        "module": "personal",
        "payload": payload,
    }
    _send_group_event(user_group(user_id), event)

    if persist:
        _persist_event(user_id, event_type, payload, audience_role_code="cliente")


def notify_guest_order(order_id, event_type: str, payload: dict[str, object]) -> None:
    event = {
        "event_type": event_type,
        "module": "guest_order",
        "payload": payload,
    }
    _send_group_event(guest_order_group(order_id), event)
