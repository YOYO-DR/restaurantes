from __future__ import annotations

import json
import uuid

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.utils.html import strip_tags

from apps.order_chat.permissions import order_chat_group

MESSAGE_RATE_LIMIT_COUNT = 30
MESSAGE_RATE_LIMIT_WINDOW = 60
MAX_MESSAGE_BODY_LENGTH = 4000
TYPING_RATE_LIMIT_COUNT = 1
TYPING_RATE_LIMIT_WINDOW = 1


def sanitize_message_body(body: str) -> str:
    text = strip_tags(body or "").strip()
    if len(text) > MAX_MESSAGE_BODY_LENGTH:
        return text[:MAX_MESSAGE_BODY_LENGTH]
    return text


def rename_uploaded_image(file_obj, extension: str) -> str:
    ext = extension.lower().replace(".", "")
    safe_ext = ext if ext else "bin"
    filename = f"{uuid.uuid4()}.{safe_ext}"
    file_obj.name = filename
    return filename


def parse_allowed_mimes(raw_mimes: str) -> set[str]:
    return {item.strip().lower() for item in raw_mimes.split(",") if item.strip()}


def assert_message_rate_limit(actor_key: str, chat_id) -> bool:
    key = f"order-chat:rate:{chat_id}:{actor_key}"
    count = cache.get(key)
    if count is None:
        cache.set(key, 1, MESSAGE_RATE_LIMIT_WINDOW)
        return True

    if int(count) >= MESSAGE_RATE_LIMIT_COUNT:
        return False

    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, int(count) + 1, MESSAGE_RATE_LIMIT_WINDOW)
    return True


def assert_typing_rate_limit(actor_key: str, chat_id) -> bool:
    key = f"order-chat:typing:{chat_id}:{actor_key}"
    count = cache.get(key)
    if count is None:
        cache.set(key, 1, TYPING_RATE_LIMIT_WINDOW)
        return True

    if int(count) >= TYPING_RATE_LIMIT_COUNT:
        return False

    try:
        cache.incr(key)
    except ValueError:
        cache.set(key, int(count) + 1, TYPING_RATE_LIMIT_WINDOW)
    return True


def message_payload(message) -> dict[str, object]:
    image_base_url = f"/api/orders/chat/messages/{message.id}/image/"
    return {
        "id": str(message.id),
        "chat_id": str(message.chat_id),
        "sender_kind": message.sender_kind,
        "sender_label": message.sender_label,
        "body": message.body,
        "image_url": f"{image_base_url}?inline=1" if message.image and not message.image_purged else None,
        "image_download_url": image_base_url if message.image and not message.image_purged else None,
        "image_purged": message.image_purged,
        "created_at": message.created_at.isoformat(),
        "read_by_customer_at": (
            message.read_by_customer_at.isoformat()
            if message.read_by_customer_at
            else None
        ),
        "read_by_restaurant_at": (
            message.read_by_restaurant_at.isoformat()
            if message.read_by_restaurant_at
            else None
        ),
    }


def broadcast_chat_event(order_id, event_type: str, payload: dict[str, object]):
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        order_chat_group(order_id),
        {
            "type": "chat_event",
            "event": {
                "event_type": event_type,
                "payload": payload,
            },
        },
    )


def build_sender_label(order, user, sender_kind: str) -> str:
    if sender_kind == "guest":
        return order.customer_name or "Cliente invitado"
    if sender_kind == "customer":
        if user and user.is_authenticated:
            return user.name or user.email or "Cliente"
        return order.customer_name or "Cliente"
    if user and user.is_authenticated:
        return user.name or user.email or "Restaurante"
    return "Restaurante"


def get_actor_key(user, tracking_code: str) -> str:
    if user and user.is_authenticated:
        return f"user:{user.id}"
    return f"guest:{tracking_code}"


def parse_ws_message(raw_text: str) -> dict[str, object] | None:
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload
