from django.db.models import Avg
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import IsAuthenticatedUser
from apps.customers.api.serializers import CustomerAddressSerializer
from apps.customers.api.serializers import CustomerPaymentMethodSerializer
from apps.customers.api.serializers import CustomerPaymentMethodWriteSerializer
from apps.customers.api.serializers import FavoriteSerializer
from apps.customers.models import CustomerAddress
from apps.customers.models import CustomerPaymentMethod
from apps.customers.models import Favorite
from apps.customers.models import PaymentMethodType
from apps.loyalty.models import LoyaltyAccount
from apps.orders.api.serializers import OrderSerializer
from apps.orders.models import Order
from apps.orders.services import filter_orders_by_scope


class CustomerAddressViewSet(ModelViewSet):
    permission_classes = [IsAuthenticatedUser]
    serializer_class = CustomerAddressSerializer

    def get_queryset(self):
        return CustomerAddress.objects.filter(user=self.request.user).select_related(
            "address_type",
        )


class CustomerDashboardViewSet(GenericViewSet):
    permission_classes = [IsAuthenticatedUser]

    def list(self, request):
        user = request.user
        order_scope = request.query_params.get("order_scope", "all").strip()
        orders_queryset = filter_orders_by_scope(
            Order.objects.filter(user=user),
            order_scope,
        )
        recent_orders = (
            orders_queryset.select_related(
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
            .order_by("-created_at")[:3],
        )
        from django.db.models import Sum
        loyalty_accounts = LoyaltyAccount.objects.filter(user=user).select_related("tier", "restaurant")
        total_points = loyalty_accounts.aggregate(Sum("current_points"))["current_points__sum"] or 0
        loyalty_breakdown = [
            {
                "restaurant_id": str(acc.restaurant.id),
                "restaurant_name": acc.restaurant.display_name,
                "restaurant_slug": acc.restaurant.slug,
                "points": acc.current_points,
                "tier": acc.tier.name,
            }
            for acc in loyalty_accounts
        ]

        total_orders = orders_queryset.count()
        average_delivery_time = (
            orders_queryset.filter(order_type__code="delivery").aggregate(
                avg=Avg("fulfillment__estimated_max_minutes"),
            )["avg"]
            or 0
        )

        return Response(
            {
                "user_name": user.name or user.email,
                "metrics": {
                    "total_orders": total_orders,
                    "points": total_points,
                    "favorite_restaurants_count": Favorite.objects.filter(
                        user=user,
                    ).count(),
                    "average_delivery_time": round(float(average_delivery_time))
                    if average_delivery_time
                    else 0,
                },
                "order_scope": order_scope,
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
                    "points": total_points,
                    "accounts": loyalty_breakdown,
                },
            },
        )


class FavoriteViewSet(ModelViewSet):
    permission_classes = [IsAuthenticatedUser]
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


class CustomerPaymentMethodViewSet(GenericViewSet):
    permission_classes = [IsAuthenticatedUser]

    def list(self, request):
        queryset = CustomerPaymentMethod.objects.filter(user=request.user).order_by(
            "-is_default",
            "-created_at",
        )
        return Response(CustomerPaymentMethodSerializer(queryset, many=True).data)

    def create(self, request):
        serializer = CustomerPaymentMethodWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payment_type, _ = PaymentMethodType.objects.get_or_create(
            code="card",
            defaults={"name": "Tarjeta"},
        )

        if serializer.validated_data.get("is_default", False):
            CustomerPaymentMethod.objects.filter(user=request.user).update(is_default=False)

        method = CustomerPaymentMethod.objects.create(
            user=request.user,
            payment_method_type=payment_type,
            provider_token=f"mock-{request.user.id}-{serializer.validated_data['masked_number']}",
            masked_number=serializer.validated_data["masked_number"],
            brand=serializer.validated_data.get("brand", ""),
            expires_at=serializer.validated_data.get("expires_at"),
            is_default=serializer.validated_data.get("is_default", False),
        )

        return Response(
            CustomerPaymentMethodSerializer(method).data,
            status=201,
        )

    def destroy(self, request, pk=None):
        method = CustomerPaymentMethod.objects.filter(user=request.user, pk=pk).first()
        if not method:
            return Response({"detail": "Metodo no encontrado."}, status=404)
        method.delete()
        return Response(status=204)
