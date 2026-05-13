import uuid
from decimal import Decimal

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone

from apps.accounts.models import Role
from apps.notifications.models import NotificationEvent
from apps.notifications.models import NotificationType
from apps.orders.models import Order

OWNER_ORDER_GROUP_PREFIX = "owner-orders"
USER_ORDER_GROUP_PREFIX = "user-orders"
GUEST_ORDER_GROUP_PREFIX = "guest-orders"


def build_guest_tracking_code() -> uuid.UUID:
    return uuid.uuid4()


def ensure_new_order_notification_type() -> NotificationType:
    owner_role, _ = Role.objects.get_or_create(
        code="restaurante",
        defaults={"name": "Restaurante"},
    )
    notification_type, _ = NotificationType.objects.get_or_create(
        code="new_order",
        defaults={
            "name": "Nuevo pedido",
            "audience_role": owner_role,
            "description": "Notifica al restaurante cuando llega un pedido nuevo.",
        },
    )
    return notification_type


def ensure_order_cancelled_notification_type() -> NotificationType:
    owner_role, _ = Role.objects.get_or_create(
        code="restaurante",
        defaults={"name": "Restaurante"},
    )
    notification_type, _ = NotificationType.objects.get_or_create(
        code="order_cancelled",
        defaults={
            "name": "Pedido cancelado",
            "audience_role": owner_role,
            "description": "Notifica al restaurante cuando un pedido es cancelado.",
        },
    )
    return notification_type


def build_order_notification_payload(order: Order) -> dict[str, object]:
    from apps.orders.api.serializers import OrderSerializer

    return make_json_safe(OrderSerializer(order).data)


def make_json_safe(value):
    if isinstance(value, dict):
        return {key: make_json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [make_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [make_json_safe(item) for item in value]
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return format(value, ".2f")
    return value


def build_owner_order_group_name(owner_id) -> str:
    return f"{OWNER_ORDER_GROUP_PREFIX}-{owner_id}"


def build_user_order_group_name(user_id) -> str:
    return f"{USER_ORDER_GROUP_PREFIX}-{user_id}"


def build_guest_order_group_name(order_id) -> str:
    return f"{GUEST_ORDER_GROUP_PREFIX}-{order_id}"


def send_realtime_event(
    group_name: str,
    event_type: str,
    payload: dict[str, object],
) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": event_type,
            "payload": payload,
        },
    )


def notify_restaurant_new_order(order: Order) -> None:
    notification_type = ensure_new_order_notification_type()
    payload = build_order_notification_payload(order)

    NotificationEvent.objects.create(
        user=order.restaurant.owner,
        notification_type=notification_type,
        payload_json=payload,
        sent_at=timezone.now(),
    )
    send_realtime_event(
        build_owner_order_group_name(order.restaurant.owner_id),
        "owner_order_created",
        payload,
    )


def notify_order_cancelled(order: Order, cancelled_by: str, reason: str = "") -> None:
    notification_type = ensure_order_cancelled_notification_type()
    payload = build_order_notification_payload(order)
    payload["cancelled_by"] = cancelled_by
    payload["cancel_reason"] = reason

    NotificationEvent.objects.create(
        user=order.restaurant.owner,
        notification_type=notification_type,
        payload_json=payload,
        sent_at=timezone.now(),
    )


def notify_order_status_updated(order: Order) -> None:
    payload = build_order_notification_payload(order)

    send_realtime_event(
        build_owner_order_group_name(order.restaurant.owner_id),
        "owner_order_updated",
        payload,
    )

    if order.user_id:
        send_realtime_event(
            build_user_order_group_name(order.user_id),
            "user_order_updated",
            payload,
        )
        return

    send_realtime_event(
        build_guest_order_group_name(order.id),
        "guest_order_updated",
        payload,
    )


def send_order_confirmation_email(order: Order) -> None:
    if not order.customer_email:
        return

    context = {
        "order": order,
        "restaurant": order.restaurant,
        "items": order.items.all(),
        "fulfillment": getattr(order, "fulfillment", None),
    }
    subject = f"Confirmacion de pedido {order.order_code}"
    text_body = render_to_string("orders/order_confirmation_email.txt", context)
    html_body = render_to_string("orders/order_confirmation_email.html", context)
    from_email = getattr(
        settings,
        "DEFAULT_FROM_EMAIL",
        getattr(settings, "SERVER_EMAIL", "no-reply@foodhub.local"),
    )

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[order.customer_email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=True)


def create_guest_customer_name(email: str, phone: str) -> str:
    if email:
        return email.split("@", maxsplit=1)[0]
    if phone:
        return phone
    return "Cliente invitado"


def build_order_code(order: Order) -> str:
    next_count = Order.objects.filter(restaurant=order.restaurant).count() + 1
    return f"ORD-{next_count:04d}"


def filter_orders_by_scope(queryset, order_scope: str):
    if order_scope == "completed":
        return queryset.filter(status__code="delivered")
    if order_scope == "non_completed":
        return queryset.exclude(status__code__in=["delivered", "cancelled"])
    return queryset


def decimal_to_string(value: Decimal) -> str:
    return format(value, ".2f")
