from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class LoyaltyTier(BaseCatalogModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="loyalty_tiers",
        null=True,
        blank=True,
    )
    min_points = models.PositiveIntegerField(default=0)
    max_points = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "code"),
                name="uniq_loyalty_tier_restaurant_code",
            ),
        ]


class LoyaltyTransactionType(BaseCatalogModel):
    description = models.TextField(blank=True)


class LoyaltyRedemptionStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class LoyaltyAccount(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="loyalty_accounts",
    )
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="loyalty_accounts",
    )
    current_points = models.IntegerField(default=0)
    lifetime_points = models.PositiveIntegerField(default=0)
    tier = models.ForeignKey(
        LoyaltyTier,
        on_delete=models.PROTECT,
        related_name="accounts",
    )

    class Meta:
        db_table = "loyalty_accounts"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "restaurant"),
                name="uniq_user_restaurant_loyalty",
            ),
        ]


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
    available_quantity = models.PositiveIntegerField(null=True, blank=True)
    max_per_user = models.PositiveIntegerField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "loyalty_rewards"


class LoyaltyTransaction(BaseModel):
    loyalty_account = models.ForeignKey(
        LoyaltyAccount,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loyalty_transactions",
    )
    tx_type = models.ForeignKey(
        LoyaltyTransactionType,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    points_delta = models.IntegerField()
    description = models.TextField(blank=True)

    class Meta:
        db_table = "loyalty_transactions"


class LoyaltyRedemption(BaseModel):
    loyalty_transaction = models.ForeignKey(
        LoyaltyTransaction,
        on_delete=models.CASCADE,
        related_name="redemptions",
    )
    loyalty_reward = models.ForeignKey(
        LoyaltyReward,
        on_delete=models.PROTECT,
        related_name="redemptions",
    )
    status = models.ForeignKey(
        LoyaltyRedemptionStatus,
        on_delete=models.PROTECT,
        related_name="redemptions",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        related_name="loyalty_redemptions",
        null=True,
        blank=True,
    )
    points_applied = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "loyalty_redemptions"


class RestaurantLoyaltySetting(BaseModel):
    restaurant = models.OneToOneField(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="loyalty_setting",
    )
    is_active = models.BooleanField(default=False)
    currency_unit_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    points_earned = models.PositiveIntegerField(default=1)
    max_redeemable_points_per_order = models.PositiveIntegerField(
        null=True,
        blank=True,
    )
    max_points_per_order = models.PositiveIntegerField(null=True, blank=True)
    vip_threshold_orders = models.PositiveIntegerField(default=100)
    point_redeem_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "restaurant_loyalty_settings"

    def clean(self):
        if self.is_active:
            if self.currency_unit_amount <= 0:
                raise ValidationError(
                    {
                        "currency_unit_amount": "Debe ser mayor a 0 cuando el programa esta activo.",
                    },
                )
            if self.points_earned <= 0:
                raise ValidationError(
                    {
                        "points_earned": "Debe ser mayor a 0 cuando el programa esta activo.",
                    },
                )
