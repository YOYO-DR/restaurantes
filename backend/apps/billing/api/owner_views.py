from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.billing.api.serializers import OwnerCreateChangeRequestSerializer
from apps.billing.api.serializers import OwnerSubscriptionSerializer
from apps.billing.api.serializers import PlanListSerializer
from apps.billing.api.serializers import PlanChangeRequestSerializer
from apps.billing.models import Plan
from apps.billing.models import PlanChangeRequest
from apps.billing.models import RestaurantSubscription
from apps.core.permissions import IsOwnerRole
from apps.core.permissions import get_user_owned_or_operated_restaurant_ids


def _get_owner_restaurant(user):
    """Returns the first owned restaurant for the authenticated owner."""
    return user.owned_restaurants.select_related("subscription").first()


class OwnerSubscriptionViewSet(GenericViewSet):
    permission_classes = [IsOwnerRole]

    def _get_subscription(self, user):
        restaurant = _get_owner_restaurant(user)
        if restaurant is None:
            return None, None
        try:
            sub = RestaurantSubscription.objects.select_related("plan").get(restaurant=restaurant)
            return restaurant, sub
        except RestaurantSubscription.DoesNotExist:
            return restaurant, None

    def list(self, request):
        restaurant, sub = self._get_subscription(request.user)
        if sub is None:
            return Response({"detail": "Sin suscripción activa."}, status=status.HTTP_404_NOT_FOUND)
        return Response(OwnerSubscriptionSerializer(sub).data)

    @action(detail=False, methods=["post"])
    def cancel(self, request):
        from apps.billing.services.subscriptions import cancel_subscription

        restaurant, sub = self._get_subscription(request.user)
        if sub is None:
            return Response({"detail": "Sin suscripción activa."}, status=status.HTTP_404_NOT_FOUND)
        try:
            sub = cancel_subscription(restaurant, actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OwnerSubscriptionSerializer(sub).data)


class OwnerAvailablePlansViewSet(GenericViewSet):
    permission_classes = [IsOwnerRole]

    def list(self, request):
        plans = Plan.objects.filter(is_active=True).exclude(is_free=True).order_by("sort_order", "name")
        return Response(PlanListSerializer(plans, many=True).data)


class OwnerPlanChangeRequestViewSet(GenericViewSet):
    permission_classes = [IsOwnerRole]

    def _get_restaurant(self, user):
        return _get_owner_restaurant(user)

    def list(self, request):
        restaurant = self._get_restaurant(request.user)
        if restaurant is None:
            return Response([])
        reqs = PlanChangeRequest.objects.filter(restaurant=restaurant).order_by("-created_at")
        return Response(PlanChangeRequestSerializer(reqs, many=True).data)

    def create(self, request):
        from apps.billing.services.requests import create_change_request

        ser = OwnerCreateChangeRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        restaurant = self._get_restaurant(request.user)
        if restaurant is None:
            return Response({"detail": "No tienes restaurante."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            plan = Plan.objects.get(pk=ser.validated_data["requested_plan"], is_active=True, is_free=False)
        except Plan.DoesNotExist:
            return Response({"detail": "Plan no encontrado o no elegible."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req = create_change_request(
                restaurant=restaurant,
                requested_plan=plan,
                requested_by=request.user,
                notes=ser.validated_data.get("notes", ""),
            )
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(PlanChangeRequestSerializer(req).data, status=status.HTTP_201_CREATED)
