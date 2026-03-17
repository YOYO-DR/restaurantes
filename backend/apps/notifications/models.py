from django.conf import settings
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class NotificationChannel(BaseCatalogModel):
    description = models.TextField(blank=True)


class NotificationType(BaseCatalogModel):
    audience_role = models.ForeignKey(
        "accounts.Role", on_delete=models.PROTECT, related_name="notification_types"
    )
    description = models.TextField(blank=True)


class UserNotificationPreference(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    notification_channel = models.ForeignKey(
        NotificationChannel,
        on_delete=models.PROTECT,
        related_name="user_preferences",
    )
    notification_type = models.ForeignKey(
        NotificationType, on_delete=models.PROTECT, related_name="user_preferences"
    )
    is_enabled = models.BooleanField(default=True)

    class Meta:
        db_table = "user_notification_preferences"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "notification_channel", "notification_type"),
                name="uniq_user_notification_preference",
            ),
        ]


class NotificationEvent(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_events",
    )
    notification_type = models.ForeignKey(
        NotificationType, on_delete=models.PROTECT, related_name="events"
    )
    payload_json = models.JSONField(default=dict)
    sent_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "notification_events"
