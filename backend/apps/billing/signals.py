from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender="restaurants.Restaurant")
def ensure_restaurant_subscription(sender, instance, created, **kwargs):
    """Auto-start trial when a new restaurant is created, deferred until commit."""
    if not created:
        return

    restaurant_id = instance.pk

    def _start():
        from apps.restaurants.models import Restaurant
        from apps.billing.services.subscriptions import start_trial

        try:
            restaurant = Restaurant.objects.get(pk=restaurant_id)
        except Restaurant.DoesNotExist:
            return
        start_trial(restaurant)

    transaction.on_commit(_start)
