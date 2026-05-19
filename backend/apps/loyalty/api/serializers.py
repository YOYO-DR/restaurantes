from rest_framework import serializers

from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import RestaurantLoyaltySetting


class RestaurantLoyaltySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantLoyaltySetting
        fields = [
            "id",
            "restaurant",
            "is_active",
            "max_customer_points_balance",
            "currency_unit_amount",
            "points_earned",
            "max_redeemable_points_per_order",
            "max_points_per_order",
            "vip_threshold_orders",
            "point_redeem_value",
            "min_payment_denomination",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        is_active = attrs.get("is_active", getattr(self.instance, "is_active", False))
        max_balance = attrs.get(
            "max_customer_points_balance",
            getattr(self.instance, "max_customer_points_balance", None),
        )

        if is_active and (max_balance is None or max_balance <= 0):
            raise serializers.ValidationError(
                {
                    "max_customer_points_balance": (
                        "Debes definir un tope maximo de puntos por cliente (mayor a 0) "
                        "cuando el programa esta activo."
                    ),
                }
            )

        # Validar bajada del tope solo en actualizaciones
        if self.instance and "max_customer_points_balance" in attrs:
            current_max = self.instance.max_customer_points_balance
            new_max = attrs["max_customer_points_balance"]
            if current_max is not None and new_max is not None and new_max < current_max:
                from apps.loyalty.models import LoyaltyAccount
                top_balance = (
                    LoyaltyAccount.objects.filter(restaurant_id=self.instance.restaurant_id)
                    .order_by("-current_points")
                    .values_list("current_points", flat=True)
                    .first()
                ) or 0
                if new_max < top_balance:
                    raise serializers.ValidationError(
                        {
                            "max_customer_points_balance": (
                                f"No puedes bajar el tope por debajo del cliente con mas puntos "
                                f"({top_balance} puntos)."
                            ),
                        }
                    )

        return attrs


class LoyaltyTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyTier
        fields = [
            "id",
            "restaurant",
            "code",
            "name",
            "is_active",
            "min_points",
            "max_points",
        ]
        read_only_fields = ["id"]


class LoyaltyRewardSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoyaltyReward
        fields = [
            "id",
            "restaurant",
            "name",
            "description",
            "points_cost",
            "is_active",
            "available_quantity",
            "max_per_user",
            "valid_until",
        ]
        read_only_fields = ["id"]


class LoyaltyRedemptionSerializer(serializers.ModelSerializer):
    reward_name = serializers.CharField(source="loyalty_reward.name", read_only=True)
    restaurant_id = serializers.UUIDField(source="loyalty_reward.restaurant_id", read_only=True)
    restaurant_slug = serializers.CharField(source="loyalty_reward.restaurant.slug", read_only=True)
    restaurant_name = serializers.CharField(source="loyalty_reward.restaurant.display_name", read_only=True)
    status_code = serializers.CharField(source="status.code", read_only=True)
    customer_name = serializers.SerializerMethodField()
    points_available = serializers.SerializerMethodField()

    class Meta:
        model = LoyaltyRedemption
        fields = [
            "id",
            "reward_name",
            "restaurant_id",
            "restaurant_slug",
            "restaurant_name",
            "status_code",
            "points_available",
            "points_applied",
            "order",
            "customer_name",
            "created_at",
        ]

    def get_customer_name(self, obj):
        account = obj.loyalty_transaction.loyalty_account
        user = account.user
        return user.name or user.email

    def get_points_available(self, obj):
        reserved_points = abs(obj.loyalty_transaction.points_delta)
        return max(reserved_points - obj.points_applied, 0)


class RedeemRewardRequestSerializer(serializers.Serializer):
    reward_id = serializers.UUIDField()
    points = serializers.IntegerField(required=False, min_value=1)
