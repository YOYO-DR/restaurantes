from __future__ import annotations

from django.db.models.signals import post_save
from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.notifications import realtime
from apps.restaurants.models import OperatorInvitation
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantReview


@receiver(pre_save, sender=Restaurant)
def restaurant_pre_save(sender, instance: Restaurant, **kwargs):
    if not instance.pk:
        instance._previous_status_id = None
        return
    previous = Restaurant.objects.filter(pk=instance.pk).only("status_id").first()
    instance._previous_status_id = previous.status_id if previous else None


@receiver(post_save, sender=Restaurant)
def restaurant_post_save(sender, instance: Restaurant, created: bool, **kwargs):
    if created:
        return
    previous_status_id = getattr(instance, "_previous_status_id", None)
    if previous_status_id == instance.status_id:
        return
    realtime.notify_restaurant(
        restaurant_id=instance.id,
        module="configuracion",
        event_type="restaurant.status_changed",
        payload={
            "restaurant_id": str(instance.id),
            "status_code": instance.status.code,
            "status_name": instance.status.name,
        },
    )


@receiver(post_save, sender=RestaurantReview)
def restaurant_review_post_save(sender, instance: RestaurantReview, created: bool, **kwargs):
    if created:
        payload = {
            "review_id": str(instance.id),
            "restaurant_id": str(instance.restaurant_id),
            "rating": instance.rating,
            "comment": instance.comment,
        }
        realtime.notify_restaurant(
            restaurant_id=instance.restaurant_id,
            module="resenas",
            event_type="review.created",
            payload=payload,
        )
        if instance.rating <= 2:
            realtime.notify_restaurant(
                restaurant_id=instance.restaurant_id,
                module="resenas",
                event_type="review.low_rating",
                payload=payload,
            )

    previous_reply = getattr(instance, "_previous_owner_reply", None)
    has_new_reply = bool(instance.owner_reply and instance.owner_reply.strip())
    if has_new_reply and (previous_reply or "").strip() != instance.owner_reply.strip() and instance.user_id:
        realtime.notify_user(
            user_id=instance.user_id,
            event_type="review.replied",
            payload={
                "review_id": str(instance.id),
                "restaurant_id": str(instance.restaurant_id),
                "response": instance.owner_reply,
            },
        )


@receiver(pre_save, sender=RestaurantReview)
def restaurant_review_pre_save(sender, instance: RestaurantReview, **kwargs):
    if not instance.pk:
        instance._previous_owner_reply = ""
        return
    previous = RestaurantReview.objects.filter(pk=instance.pk).only("owner_reply").first()
    instance._previous_owner_reply = previous.owner_reply if previous else ""


@receiver(pre_save, sender=OperatorInvitation)
def operator_invitation_pre_save(sender, instance: OperatorInvitation, **kwargs):
    if not instance.pk:
        instance._previous_accepted_at = None
        return
    previous = OperatorInvitation.objects.filter(pk=instance.pk).only("accepted_at").first()
    instance._previous_accepted_at = previous.accepted_at if previous else None


@receiver(post_save, sender=OperatorInvitation)
def operator_invitation_post_save(sender, instance: OperatorInvitation, **kwargs):
    previous_accepted_at = getattr(instance, "_previous_accepted_at", None)
    if previous_accepted_at is None and instance.accepted_at is not None:
        realtime.notify_restaurant(
            restaurant_id=instance.restaurant_id,
            module="configuracion",
            event_type="operator.invitation_accepted",
            payload={
                "invitation_id": str(instance.id),
                "email": instance.email,
                "accepted_at": instance.accepted_at.isoformat(),
            },
        )
