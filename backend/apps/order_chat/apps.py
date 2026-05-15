from __future__ import annotations

from django.apps import AppConfig
from django.db.models.signals import post_migrate
from django.utils.translation import gettext_lazy as _


def seed_order_chat_beat(sender, **kwargs):
    if sender.name != "apps.order_chat":
        return

    from apps.order_chat.tasks import ensure_order_chat_periodic_tasks

    ensure_order_chat_periodic_tasks()


class OrderChatConfig(AppConfig):
    name = "apps.order_chat"
    verbose_name = _("Order Chat")

    def ready(self):
        from apps.order_chat import signals  # noqa: F401

        post_migrate.connect(
            seed_order_chat_beat,
            sender=self,
            dispatch_uid="apps.order_chat.seed_order_chat_beat",
        )
