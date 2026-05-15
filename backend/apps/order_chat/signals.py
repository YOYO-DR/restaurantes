from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.order_chat.models import OrderChat
from apps.order_chat.tasks import schedule_order_chat_purge
from apps.orders.models import Order


@receiver(post_save, sender=Order)
def ensure_order_chat(sender, instance: Order, created: bool, **kwargs):
    if created:
        OrderChat.objects.get_or_create(order=instance)

    status_code = getattr(getattr(instance, "status", None), "code", "")
    if status_code not in {"delivered", "cancelled"}:
        return

    chat, _ = OrderChat.objects.get_or_create(order=instance)
    if chat.images_purged_at is not None:
        return
    if chat.purge_task_id:
        return

    schedule_order_chat_purge(chat)
