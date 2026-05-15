from __future__ import annotations

from django.db.models.signals import post_save
from django.db.models.signals import pre_save
from django.dispatch import receiver

from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyTransaction
from apps.notifications import realtime


@receiver(pre_save, sender=LoyaltyAccount)
def loyalty_account_pre_save(sender, instance: LoyaltyAccount, **kwargs):
    if not instance.pk:
        instance._previous_tier_id = None
        return
    previous = LoyaltyAccount.objects.filter(pk=instance.pk).only("tier_id").first()
    instance._previous_tier_id = previous.tier_id if previous else None


@receiver(post_save, sender=LoyaltyTransaction)
def loyalty_transaction_post_save(sender, instance: LoyaltyTransaction, created: bool, **kwargs):
    if not created:
        return

    if instance.points_delta > 0:
        realtime.notify_user(
            user_id=instance.loyalty_account.user_id,
            event_type="loyalty.points_earned",
            payload={
                "transaction_id": str(instance.id),
                "points": instance.points_delta,
                "restaurant_id": str(instance.loyalty_account.restaurant_id),
                "description": instance.description,
            },
        )


@receiver(post_save, sender=LoyaltyAccount)
def loyalty_account_post_save(sender, instance: LoyaltyAccount, **kwargs):
    previous_tier_id = getattr(instance, "_previous_tier_id", None)
    if previous_tier_id and previous_tier_id != instance.tier_id:
        realtime.notify_user(
            user_id=instance.user_id,
            event_type="loyalty.tier_upgraded",
            payload={
                "restaurant_id": str(instance.restaurant_id),
                "tier": instance.tier.name,
                "current_points": instance.current_points,
            },
        )


@receiver(post_save, sender=LoyaltyRedemption)
def loyalty_redemption_post_save(sender, instance: LoyaltyRedemption, created: bool, **kwargs):
    if not created:
        return

    realtime.notify_user(
        user_id=instance.loyalty_transaction.loyalty_account.user_id,
        event_type="loyalty.reward_redeemed",
        payload={
            "redemption_id": str(instance.id),
            "reward_id": str(instance.loyalty_reward_id),
            "reward_name": instance.loyalty_reward.name,
            "status": instance.status.code,
        },
    )
