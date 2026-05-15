from __future__ import annotations

from django.contrib import admin

from apps.order_chat.models import OrderChat
from apps.order_chat.models import OrderChatMessage
from apps.order_chat.tasks import purge_order_chat_images


@admin.action(description="Forzar purge de imagenes")
def force_purge_images(modeladmin, request, queryset):
    for chat in queryset:
        purge_order_chat_images.delay(str(chat.order_id))


@admin.register(OrderChat)
class OrderChatAdmin(admin.ModelAdmin):
    list_display = ["id", "order", "is_closed", "closed_at", "images_purged_at"]
    readonly_fields = ["id", "created_at", "updated_at", "closed_at", "images_purged_at"]
    search_fields = ["order__order_code"]
    actions = [force_purge_images]


@admin.register(OrderChatMessage)
class OrderChatMessageAdmin(admin.ModelAdmin):
    list_display = ["id", "chat", "sender_kind", "sender_label", "created_at", "image_purged"]
    readonly_fields = ["id", "created_at", "updated_at"]
    search_fields = ["chat__order__order_code", "sender_label", "body"]
