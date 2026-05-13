from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.permissions import IsAuthenticatedUser
from apps.customers.models import Favorite
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyReward


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

        if len(accounts) == 1 and restaurant_id:
            current_level = accounts[0].tier.name
        else:
            current_level = "Varios" if accounts else "Base"

        favorite_restaurants = Favorite.objects.filter(
            user=request.user,
        ).select_related("restaurant")
        fav_restaurant_ids = [favorite.restaurant_id for favorite in favorite_restaurants]
        if restaurant_id and restaurant_id not in fav_restaurant_ids:
            fav_restaurant_ids.append(restaurant_id)

        available_rewards = LoyaltyReward.objects.filter(
            restaurant_id__in=fav_restaurant_ids,
            is_active=True,
        ).select_related("restaurant")[:8]

        from apps.loyalty.models import LoyaltyTransaction
        tx_qs = LoyaltyTransaction.objects.filter(
            loyalty_account__in=accounts,
        ).select_related("tx_type", "order", "loyalty_account__restaurant").order_by("-created_at")[:20]

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

        return Response(
            {
                "current_points": current_points,
                "total_earned": total_earned,
                "current_level": current_level,
                "rewards_redeemed": rewards_redeemed,
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
            },
        )

