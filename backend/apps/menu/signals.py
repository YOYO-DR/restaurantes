from __future__ import annotations

from django.db.models.signals import post_save
from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.menu.models import InventoryStockMovement
from apps.menu.models import MenuItem
from apps.notifications import realtime


@receiver(pre_save, sender=MenuItem)
def menu_item_pre_save(sender, instance: MenuItem, **kwargs):
    if not instance.pk:
        instance._previous_is_available = None
        return
    previous = MenuItem.objects.filter(pk=instance.pk).only("is_available").first()
    instance._previous_is_available = previous.is_available if previous else None


@receiver(post_save, sender=MenuItem)
def menu_item_post_save(sender, instance: MenuItem, created: bool, **kwargs):
    payload = {
        "menu_item_id": str(instance.id),
        "restaurant_id": str(instance.restaurant_id),
        "name": instance.name,
        "is_available": instance.is_available,
    }

    if created:
        realtime.notify_restaurant(
            restaurant_id=instance.restaurant_id,
            module="menu",
            event_type="menu_item.created",
            payload=payload,
        )
        return

    realtime.notify_restaurant(
        restaurant_id=instance.restaurant_id,
        module="menu",
        event_type="menu_item.updated",
        payload=payload,
    )

    previous_is_available = getattr(instance, "_previous_is_available", None)
    if previous_is_available is not None and previous_is_available != instance.is_available:
        realtime.notify_restaurant(
            restaurant_id=instance.restaurant_id,
            module="menu",
            event_type="menu_item.availability_changed",
            payload=payload,
        )


@receiver(post_save, sender=InventoryStockMovement)
def inventory_movement_post_save(sender, instance: InventoryStockMovement, created: bool, **kwargs):
    if not created:
        return

    inventory_item = instance.inventory_item
    restaurant_id = inventory_item.restaurant_id
    payload = {
        "movement_id": str(instance.id),
        "inventory_item_id": str(inventory_item.id),
        "inventory_item_name": inventory_item.name,
        "current_stock": str(inventory_item.current_stock),
        "min_stock": str(inventory_item.min_stock) if inventory_item.min_stock is not None else None,
        "movement_type": instance.movement_type.code,
        "quantity": str(instance.quantity),
    }

    realtime.notify_restaurant(
        restaurant_id=restaurant_id,
        module="inventario",
        event_type="inventory.movement",
        payload=payload,
    )

    if inventory_item.min_stock is not None and inventory_item.current_stock <= inventory_item.min_stock:
        realtime.notify_restaurant(
            restaurant_id=restaurant_id,
            module="inventario",
            event_type="inventory.low_stock",
            payload=payload,
        )

    if inventory_item.current_stock == 0:
        realtime.notify_restaurant(
            restaurant_id=restaurant_id,
            module="inventario",
            event_type="inventory.out_of_stock",
            payload=payload,
        )

        menu_item_ids = list(
            inventory_item.menu_ingredients.values_list("menu_item_id", flat=True),
        )
        if menu_item_ids:
            MenuItem.objects.filter(id__in=menu_item_ids).update(is_available=False)
            for menu_item in MenuItem.objects.filter(id__in=menu_item_ids):
                realtime.notify_restaurant(
                    restaurant_id=restaurant_id,
                    module="menu",
                    event_type="menu_item.out_of_stock",
                    payload={
                        "menu_item_id": str(menu_item.id),
                        "menu_item_name": menu_item.name,
                        "inventory_item_id": str(inventory_item.id),
                        "inventory_item_name": inventory_item.name,
                    },
                )
