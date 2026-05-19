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
    points_uncapped = models.PositiveIntegerField(null=True, blank=True)
    cap_applied = models.BooleanField(default=False)
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
    order_item = models.ForeignKey(
        "orders.OrderItem",
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
    max_customer_points_balance = models.PositiveIntegerField(null=True, blank=True)
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
            if self.max_customer_points_balance is None or self.max_customer_points_balance <= 0:
                raise ValidationError(
                    {
                        "max_customer_points_balance": "Debes definir un tope maximo de puntos por cliente (mayor a 0) cuando el programa esta activo.",
                    },
                )

        if self.max_customer_points_balance is not None and self.pk:
            original = RestaurantLoyaltySetting.objects.filter(pk=self.pk).values_list(
                "max_customer_points_balance", flat=True
            ).first()
            if original is not None and self.max_customer_points_balance < original:
                from apps.loyalty.models import LoyaltyAccount
                max_client_balance = (
                    LoyaltyAccount.objects.filter(restaurant_id=self.restaurant_id)
                    .order_by("-current_points")
                    .values_list("current_points", flat=True)
                    .first()
                ) or 0
                if self.max_customer_points_balance < max_client_balance:
                    raise ValidationError(
                        {
                            "max_customer_points_balance": (
                                f"No puedes bajar el tope por debajo del cliente con mas puntos "
                                f"({max_client_balance} puntos)."
                            ),
                        },
                    )
