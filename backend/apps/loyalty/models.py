from django.conf import settings
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class LoyaltyTier(BaseCatalogModel):
    min_points = models.PositiveIntegerField(default=0)
    max_points = models.PositiveIntegerField(blank=True, null=True)


class LoyaltyTransactionType(BaseCatalogModel):
    description = models.TextField(blank=True)


class LoyaltyRedemptionStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class LoyaltyAccount(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="loyalty_account",
    )
    current_points = models.IntegerField(default=0)
    lifetime_points = models.PositiveIntegerField(default=0)
    tier = models.ForeignKey(
        LoyaltyTier, on_delete=models.PROTECT, related_name="accounts"
    )

    class Meta:
        db_table = "loyalty_accounts"


class LoyaltyReward(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="loyalty_rewards",
    )
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    points_cost = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "loyalty_rewards"


class LoyaltyTransaction(BaseModel):
    loyalty_account = models.ForeignKey(
        LoyaltyAccount, on_delete=models.CASCADE, related_name="transactions"
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loyalty_transactions",
    )
    tx_type = models.ForeignKey(
        LoyaltyTransactionType, on_delete=models.PROTECT, related_name="transactions"
    )
    points_delta = models.IntegerField()
    description = models.TextField(blank=True)

    class Meta:
        db_table = "loyalty_transactions"


class LoyaltyRedemption(BaseModel):
    loyalty_transaction = models.ForeignKey(
        LoyaltyTransaction, on_delete=models.CASCADE, related_name="redemptions"
    )
    loyalty_reward = models.ForeignKey(
        LoyaltyReward, on_delete=models.PROTECT, related_name="redemptions"
    )
    status = models.ForeignKey(
        LoyaltyRedemptionStatus, on_delete=models.PROTECT, related_name="redemptions"
    )

    class Meta:
        db_table = "loyalty_redemptions"
