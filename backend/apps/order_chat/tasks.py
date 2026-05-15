from __future__ import annotations

from datetime import timedelta

from celery import shared_task
from django.utils import timezone
from django_celery_beat.models import CrontabSchedule
from django_celery_beat.models import PeriodicTask

from apps.order_chat.models import OrderChat
from apps.order_chat.services import broadcast_chat_event
from apps.platform_config.models import PlatformSetting


def _platform_setting() -> PlatformSetting:
    setting = PlatformSetting.objects.first()
    if setting is not None:
        return setting
    return PlatformSetting.objects.create(platform_name="FoodHub")


def ensure_order_chat_periodic_tasks() -> None:
    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="*",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
    )

    PeriodicTask.objects.update_or_create(
        name="order_chat.purge_expired_chat_images_beat",
        defaults={
            "task": "apps.order_chat.tasks.purge_expired_chat_images_beat",
            "crontab": schedule,
            "enabled": True,
        },
    )


def schedule_order_chat_purge(chat: OrderChat) -> str:
    setting = _platform_setting()
    eta = timezone.now() + timedelta(hours=setting.chat_post_close_purge_hours)
    result = purge_order_chat_images.apply_async(args=[str(chat.order_id)], eta=eta)
    chat.purge_task_id = result.id
    chat.save(update_fields=["purge_task_id", "updated_at"])
    return result.id


@shared_task
def purge_order_chat_images(order_id: str):
    try:
        chat = OrderChat.objects.select_related("order", "order__status").get(order_id=order_id)
    except OrderChat.DoesNotExist:
        return

    if chat.images_purged_at is not None:
        return

    setting = _platform_setting()
    status_code = chat.order.status.code
    if status_code not in {"delivered", "cancelled"}:
        return

    cutoff = timezone.now() - timedelta(hours=setting.chat_post_close_purge_hours)
    latest_closed_status = (
        chat.order.status_history.filter(status__code__in=["delivered", "cancelled"])
        .order_by("-changed_at")
        .first()
    )
    if not latest_closed_status or latest_closed_status.changed_at > cutoff:
        return

    messages = chat.messages.filter(image__isnull=False).exclude(image="")
    for message in messages:
        try:
            message.image.delete(save=False)
        except Exception:
            pass
        message.image = None
        message.image_purged = True
        message.save(update_fields=["image", "image_purged", "updated_at"])

    now = timezone.now()
    chat.is_closed = True
    chat.closed_at = now
    chat.images_purged_at = now
    chat.save(update_fields=["is_closed", "closed_at", "images_purged_at", "updated_at"])
    broadcast_chat_event(chat.order_id, "chat.closed", {})


@shared_task
def purge_expired_chat_images_beat():
    setting = _platform_setting()
    cutoff = timezone.now() - timedelta(hours=setting.chat_post_close_purge_hours)

    candidates = (
        OrderChat.objects.select_related("order", "order__status")
        .filter(images_purged_at__isnull=True, order__status__code__in=["delivered", "cancelled"])
    )

    for chat in candidates:
        latest_closed_status = (
            chat.order.status_history.filter(status__code__in=["delivered", "cancelled"])
            .order_by("-changed_at")
            .first()
        )
        if not latest_closed_status:
            continue
        if latest_closed_status.changed_at <= cutoff:
            purge_order_chat_images.delay(str(chat.order_id))
