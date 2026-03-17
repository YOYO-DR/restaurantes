from datetime import timedelta

from django.db.models import Avg
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ModelViewSet

from apps.customers.api.serializers import CustomerAddressSerializer
from apps.customers.api.serializers import FavoriteSerializer
from apps.customers.models import Favorite
from apps.customers.models import CustomerAddress
from apps.loyalty.models import LoyaltyAccount
from apps.orders.api.serializers import OrderSerializer
from apps.orders.models import Order


class CustomerAddressViewSet(ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomerAddressSerializer

    def get_queryset(self):
        return CustomerAddress.objects.filter(user=self.request.user).select_related(
            "address_type"
        )


class CustomerDashboardViewSet(GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        user = request.user
        recent_orders = (
            Order.objects.filter(user=user)
            .select_related(
                "restaurant",
                "status",
                "order_type",
                "fulfillment__delivery_address",
                "fulfillment__table",
            )
            .prefetch_related("items")
            .order_by("-created_at")[:3]
        )
        favorites = list(
            Favorite.objects.filter(user=user)
            .select_related("restaurant", "restaurant__category")
            .order_by("-created_at")[:3]
        )
        loyalty_account = (
            LoyaltyAccount.objects.filter(user=user).select_related("tier").first()
        )
        total_orders = Order.objects.filter(user=user).count()
        average_delivery_time = (
            Order.objects.filter(user=user, order_type__code="delivery").aggregate(
                avg=Avg("fulfillment__estimated_max_minutes")
            )["avg"]
            or 0
        )

        return Response(
            {
                "user_name": user.name or user.email,
                "metrics": {
                    "total_orders": total_orders,
                    "points": loyalty_account.current_points if loyalty_account else 0,
                    "favorite_restaurants_count": Favorite.objects.filter(
                        user=user
                    ).count(),
                    "average_delivery_time": round(float(average_delivery_time))
                    if average_delivery_time
                    else 0,
                },
                "recent_orders": OrderSerializer(recent_orders, many=True).data,
                "favorite_restaurants": [
                    {
                        "id": str(favorite.restaurant.id),
                        "name": favorite.restaurant.display_name,
                        "category": favorite.restaurant.category.name,
                        "rating": str(favorite.restaurant.average_rating),
                        "slug": favorite.restaurant.slug,
                    }
                    for favorite in favorites
                ],
                "loyalty": {
                    "points": loyalty_account.current_points if loyalty_account else 0,
                    "tier": loyalty_account.tier.name if loyalty_account else "Base",
                },
            }
        )


class FavoriteViewSet(ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FavoriteSerializer

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related(
            "restaurant",
            "restaurant__category",
            "restaurant__status",
            "restaurant__order_capability",
            "restaurant__delivery_setting",
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
