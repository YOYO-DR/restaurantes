from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.notifications import realtime
from apps.orders.models import OrderPaymentTransaction
from apps.orders.services import build_order_notification_payload


@receiver(post_save, sender=OrderPaymentTransaction)
def order_payment_transaction_post_save(
    sender,
    instance: OrderPaymentTransaction,
    created: bool,
    **kwargs,
):
    if not created:
        return

    payment_status = instance.payment_status.code
    if payment_status not in {"completed", "failed"}:
        return

    event_type = (
        "order.payment_completed"
        if payment_status == "completed"
        else "order.payment_failed"
    )
    order = instance.order
    payload = {
        **build_order_notification_payload(order),
        "payment_status": payment_status,
        "transaction_id": str(instance.id),
        "amount": str(instance.amount),
        "provider_name": instance.provider_name,
    }

    realtime.notify_restaurant(
        restaurant_id=order.restaurant_id,
        module="pedidos",
        event_type=event_type,
        payload=payload,
    )

    if order.user_id:
        realtime.notify_user(
            user_id=order.user_id,
            event_type=event_type,
            payload=payload,
        )
