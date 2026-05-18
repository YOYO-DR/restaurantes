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
            "currency_unit_amount",
            "points_earned",
            "max_redeemable_points_per_order",
            "max_points_per_order",
            "vip_threshold_orders",
            "point_redeem_value",
        ]
        read_only_fields = ["id"]


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
