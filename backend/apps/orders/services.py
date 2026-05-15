import uuid
from decimal import Decimal

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from apps.notifications import realtime
from apps.orders.models import Order

def build_guest_tracking_code() -> uuid.UUID:
    return uuid.uuid4()


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


def notify_restaurant_new_order(order: Order) -> None:
    payload = build_order_notification_payload(order)
    realtime.notify_restaurant(
        restaurant_id=order.restaurant_id,
        module="pedidos",
        event_type="order.created",
        payload=payload,
    )

    if order.user_id:
        realtime.notify_user(
            user_id=order.user_id,
            event_type="order.created",
            payload=payload,
        )


def notify_order_cancelled(order: Order, cancelled_by: str, reason: str = "") -> None:
    payload = build_order_notification_payload(order)
    payload["cancelled_by"] = cancelled_by
    payload["cancel_reason"] = reason
    realtime.notify_restaurant(
        restaurant_id=order.restaurant_id,
        module="pedidos",
        event_type="order.cancelled",
        payload=payload,
    )

    if order.user_id:
        realtime.notify_user(
            user_id=order.user_id,
            event_type="order.cancelled",
            payload=payload,
        )
    else:
        realtime.notify_guest_order(
            order_id=order.id,
            event_type="order.cancelled",
            payload=payload,
        )


def notify_order_status_updated(order: Order) -> None:
    payload = build_order_notification_payload(order)
    realtime.notify_restaurant(
        restaurant_id=order.restaurant_id,
        module="pedidos",
        event_type="order.status_changed",
        payload=payload,
    )

    if order.user_id:
        realtime.notify_user(
            user_id=order.user_id,
            event_type="order.status_changed",
            payload=payload,
        )
        return

    realtime.notify_guest_order(
        order_id=order.id,
        event_type="order.status_changed",
        payload=payload,
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


def generate_order_code() -> str:
    from django.db.models import Max

    last_code = Order.objects.aggregate(max_code=Max("order_code"))["max_code"]
    if last_code and last_code.startswith("ORD-"):
        try:
            next_count = int(last_code[4:]) + 1
        except ValueError:
            next_count = 1
    else:
        next_count = 1
    return f"ORD-{next_count:04d}"


def filter_orders_by_scope(queryset, order_scope: str):
    if order_scope == "completed":
        return queryset.filter(status__code="delivered")
    if order_scope == "non_completed":
        return queryset.exclude(status__code__in=["delivered", "cancelled"])
    return queryset


def decimal_to_string(value: Decimal) -> str:
    return format(value, ".2f")
