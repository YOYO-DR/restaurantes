from django.db.models import Sum
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsAuthenticatedUser
from apps.core.permissions import LealtadModulePermission
from apps.core.permissions import get_user_owned_or_operated_restaurant_ids
from apps.core.permissions import is_admin_user
from apps.customers.models import Favorite
from apps.loyalty.api.serializers import LoyaltyRedemptionSerializer
from apps.loyalty.api.serializers import LoyaltyRewardSerializer
from apps.loyalty.api.serializers import LoyaltyTierSerializer
from apps.loyalty.api.serializers import RedeemRewardRequestSerializer
from apps.loyalty.api.serializers import RestaurantLoyaltySettingSerializer
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.loyalty.services import redeem_reward
from apps.loyalty.services import cancel_redemption


class CustomerLoyaltyViewSet(GenericViewSet):
    permission_classes = [IsAuthenticatedUser]

    def list(self, request):
        restaurant_id = request.query_params.get("restaurant_id")

        accounts_qs = LoyaltyAccount.objects.filter(user=request.user).select_related("tier", "restaurant")
        if restaurant_id:
            accounts_qs = accounts_qs.filter(restaurant_id=restaurant_id)

        accounts = list(accounts_qs)

        current_points = sum(acc.current_points for acc in accounts)
        total_earned = sum(acc.lifetime_points for acc in accounts)

        if len(accounts) == 1:
            current_level = accounts[0].tier.name
        else:
            current_level = "Varios" if accounts else "Base"

        points_by_restaurant = [
            {
                "restaurant_id": str(account.restaurant_id),
                "restaurant_name": account.restaurant.display_name,
                "current_points": account.current_points,
                "total_earned": account.lifetime_points,
                "current_level": account.tier.name,
            }
            for account in accounts
        ]

        favorite_restaurants = Favorite.objects.filter(user=request.user).select_related("restaurant")
        fav_restaurant_ids = {str(favorite.restaurant_id) for favorite in favorite_restaurants}
        if restaurant_id:
            fav_restaurant_ids.add(str(restaurant_id))

        available_rewards = LoyaltyReward.objects.filter(
            restaurant_id__in=fav_restaurant_ids,
            is_active=True,
            points_cost__lte=current_points,
        ).select_related("restaurant")[:8]

        tx_qs = LoyaltyTransaction.objects.filter(loyalty_account__in=accounts).select_related(
            "tx_type",
            "order",
            "loyalty_account__restaurant",
        ).order_by("-created_at")[:20]

        transactions = [
            {
                "id": str(transaction.id),
                "restaurant_name": transaction.loyalty_account.restaurant.display_name,
                "date": transaction.created_at.date().isoformat(),
                "description": transaction.description
                or (
                    f"Pedido {transaction.order.order_code}"
                    if transaction.order
                    else transaction.tx_type.name
                ),
                "points": transaction.points_delta,
                "type": "redeemed" if transaction.points_delta < 0 else "earned",
            }
            for transaction in tx_qs
        ]

        rewards_redeemed = LoyaltyTransaction.objects.filter(
            loyalty_account__in=accounts,
            points_delta__lt=0,
        ).count()

        loyalty_setting = None
        if restaurant_id:
            loyalty_setting = RestaurantLoyaltySetting.objects.filter(
                restaurant_id=restaurant_id,
            ).first()

        tiers = LoyaltyTier.objects.none()
        if restaurant_id:
            tiers = LoyaltyTier.objects.filter(restaurant_id=restaurant_id).order_by("min_points")
            if not tiers.exists():
                tiers = LoyaltyTier.objects.filter(restaurant__isnull=True).order_by("min_points")

        return Response(
            {
                "current_points": current_points,
                "total_earned": total_earned,
                "current_level": current_level,
                "rewards_redeemed": rewards_redeemed,
                "is_active": bool(getattr(loyalty_setting, "is_active", False)),
                "currency_unit_amount": str(
                    getattr(loyalty_setting, "currency_unit_amount", "0.00"),
                ),
                "points_earned": getattr(loyalty_setting, "points_earned", 0),
                "max_redeemable_points_per_order": getattr(
                    loyalty_setting,
                    "max_redeemable_points_per_order",
                    None,
                ),
                "max_customer_points_balance": getattr(
                    loyalty_setting,
                    "max_customer_points_balance",
                    None,
                ),
                "point_redeem_value": str(
                    getattr(loyalty_setting, "point_redeem_value", "0.00")
                    if getattr(loyalty_setting, "point_redeem_value", None) is not None
                    else "",
                ),
                "points_by_restaurant": points_by_restaurant,
                "tiers": LoyaltyTierSerializer(tiers, many=True).data,
                "available_rewards": [
                    {
                        "id": str(reward.id),
                        "name": reward.name,
                        "points": reward.points_cost,
                        "description": reward.description,
                        "restaurant_id": str(reward.restaurant_id),
                        "restaurant_slug": reward.restaurant.slug,
                        "restaurant_name": reward.restaurant.display_name,
                    }
                    for reward in available_rewards
                ],
                "history": transactions,
            },
        )

    @action(detail=False, methods=["post"], url_path="redeem")
    def redeem(self, request):
        serializer = RedeemRewardRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reward = LoyaltyReward.objects.filter(pk=serializer.validated_data["reward_id"]).first()
        if not reward:
            return Response({"detail": "Recompensa no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        try:
            redemption = redeem_reward(
                request.user,
                reward,
                serializer.validated_data.get("points"),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoyaltyRedemptionSerializer(redemption).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="redemptions")
    def redemptions(self, request):
        status_code = request.query_params.get("status")
        queryset = LoyaltyRedemption.objects.filter(
            loyalty_transaction__loyalty_account__user=request.user,
        ).select_related(
            "status",
            "loyalty_reward",
            "loyalty_transaction__loyalty_account__user",
        )
        if status_code:
            queryset = queryset.filter(status__code=status_code)
        return Response(LoyaltyRedemptionSerializer(queryset.order_by("-created_at"), many=True).data)

    @action(detail=True, methods=["delete"], url_path="redemptions")
    def cancel_redemption(self, request, pk=None):
        redemption = LoyaltyRedemption.objects.filter(
            pk=pk,
            loyalty_transaction__loyalty_account__user=request.user,
        ).select_related(
            "status",
            "loyalty_reward",
            "loyalty_transaction__loyalty_account",
        ).first()
        if not redemption:
            return Response({"detail": "Canje no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        try:
            updated = cancel_redemption(request.user, redemption)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(LoyaltyRedemptionSerializer(updated).data, status=status.HTTP_200_OK)


class OwnerRestaurantLoyaltySettingViewSet(GenericViewSet):
    permission_classes = [LealtadModulePermission]
    serializer_class = RestaurantLoyaltySettingSerializer
    lookup_field = "restaurant_id"
    lookup_url_kwarg = "restaurant_id"

    def retrieve(self, request, restaurant_id=None):
        setting, _ = RestaurantLoyaltySetting.objects.get_or_create(
            restaurant_id=restaurant_id,
        )
        return Response(self.serializer_class(setting).data)

    def partial_update(self, request, restaurant_id=None):
        setting, _ = RestaurantLoyaltySetting.objects.get_or_create(
            restaurant_id=restaurant_id,
        )
        serializer = self.serializer_class(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, restaurant_id=None):
        return self.partial_update(request, restaurant_id=restaurant_id)


class OwnerLoyaltyTierViewSet(ModelViewSet):
    permission_classes = [LealtadModulePermission]
    serializer_class = LoyaltyTierSerializer
    queryset = LoyaltyTier.objects.select_related("restaurant")

    def get_queryset(self):
        queryset = self.queryset.order_by("min_points")
        restaurant_id = self.request.query_params.get("restaurant")
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        if is_admin_user(self.request.user):
            return queryset
        restaurant_ids = get_user_owned_or_operated_restaurant_ids(self.request.user)
        return queryset.filter(restaurant_id__in=restaurant_ids)


class OwnerLoyaltyRewardViewSet(ModelViewSet):
    permission_classes = [LealtadModulePermission]
    serializer_class = LoyaltyRewardSerializer
    queryset = LoyaltyReward.objects.select_related("restaurant")

    def get_queryset(self):
        queryset = self.queryset.order_by("name")
        restaurant_id = self.request.query_params.get("restaurant")
        if restaurant_id:
            queryset = queryset.filter(restaurant_id=restaurant_id)
        if is_admin_user(self.request.user):
            return queryset
        restaurant_ids = get_user_owned_or_operated_restaurant_ids(self.request.user)
        return queryset.filter(restaurant_id__in=restaurant_ids)


class OwnerRestaurantLoyaltyRedemptionViewSet(GenericViewSet):
    permission_classes = [LealtadModulePermission]

    def list(self, request):
        restaurant_id = request.query_params.get("restaurant")
        queryset = LoyaltyRedemption.objects.select_related(
            "status",
            "loyalty_reward",
            "loyalty_transaction__loyalty_account__user",
            "order",
        ).order_by("-created_at")
        if restaurant_id:
            queryset = queryset.filter(
                loyalty_reward__restaurant_id=restaurant_id,
            )
        if not is_admin_user(request.user):
            restaurant_ids = get_user_owned_or_operated_restaurant_ids(request.user)
            queryset = queryset.filter(loyalty_reward__restaurant_id__in=restaurant_ids)
        return Response(LoyaltyRedemptionSerializer(queryset, many=True).data)
