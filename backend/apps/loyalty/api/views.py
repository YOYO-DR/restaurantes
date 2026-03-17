from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.customers.models import Favorite
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyReward


class CustomerLoyaltyViewSet(GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        loyalty_account = (
            LoyaltyAccount.objects.filter(user=request.user)
            .select_related("tier")
            .first()
        )
        favorite_restaurants = Favorite.objects.filter(
            user=request.user
        ).select_related("restaurant")
        restaurant_ids = [favorite.restaurant_id for favorite in favorite_restaurants]
        available_rewards = LoyaltyReward.objects.filter(
            restaurant_id__in=restaurant_ids,
            is_active=True,
        ).select_related("restaurant")[:8]

        transactions = []
        if loyalty_account:
            transactions = [
                {
                    "id": str(transaction.id),
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
                for transaction in loyalty_account.transactions.select_related(
                    "tx_type", "order"
                ).order_by("-created_at")[:10]
            ]

        return Response(
            {
                "current_points": loyalty_account.current_points
                if loyalty_account
                else 0,
                "total_earned": loyalty_account.lifetime_points
                if loyalty_account
                else 0,
                "current_level": loyalty_account.tier.name
                if loyalty_account
                else "Base",
                "rewards_redeemed": len(
                    [tx for tx in transactions if tx["points"] < 0]
                ),
                "available_rewards": [
                    {
                        "id": str(reward.id),
                        "name": reward.name,
                        "points": reward.points_cost,
                        "description": reward.description,
                        "restaurant_name": reward.restaurant.display_name,
                    }
                    for reward in available_rewards
                ],
                "history": transactions,
            }
        )
