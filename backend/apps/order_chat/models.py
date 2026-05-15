from __future__ import annotations

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel


class OrderChat(BaseModel):
    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="chat",
    )
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    images_purged_at = models.DateTimeField(null=True, blank=True)
    purge_task_id = models.CharField(max_length=120, blank=True)

    class Meta:
        db_table = "order_chats"


class OrderChatMessage(BaseModel):
    class SenderKind(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        RESTAURANT = "restaurant", "Restaurant"
        GUEST = "guest", "Guest"

    chat = models.ForeignKey(
        OrderChat,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_chat_messages",
    )
    sender_kind = models.CharField(max_length=20, choices=SenderKind.choices)
    sender_label = models.CharField(max_length=120, blank=True)
    body = models.TextField(blank=True)
    image = models.FileField(upload_to="order-chat/%Y/%m/", blank=True, null=True)
    image_purged = models.BooleanField(default=False)
    read_by_customer_at = models.DateTimeField(null=True, blank=True)
    read_by_restaurant_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "order_chat_messages"
        indexes = [models.Index(fields=("chat", "created_at"))]

    def clean(self):
        if not self.body and not self.image:
            raise ValidationError("El mensaje requiere texto o imagen.")
