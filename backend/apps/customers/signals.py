from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.customers.models import Favorite
from apps.notifications import realtime


@receiver(post_save, sender=Favorite)
def favorite_post_save(sender, instance: Favorite, created: bool, **kwargs):
    if not created:
        return

    realtime.notify_restaurant(
        restaurant_id=instance.restaurant_id,
        module="clientes",
        event_type="customer.favorited",
        payload={
            "favorite_id": str(instance.id),
            "restaurant_id": str(instance.restaurant_id),
            "user_id": str(instance.user_id),
        },
    )
