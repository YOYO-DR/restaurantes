from rest_framework import permissions
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.core.permissions import IsAuthenticatedUser
from apps.core.permissions import IsOwnerOrAdminRole
from apps.core.permissions import PedidosModulePermission
from apps.core.permissions import get_user_owned_or_operated_restaurant_ids
from apps.core.permissions import is_admin_user
from apps.loyalty.services import assign_points_for_order
from apps.orders.api.serializers import CheckoutSerializer
from apps.orders.api.serializers import OrderCancelSerializer
from apps.orders.api.serializers import OrderSerializer
from apps.orders.api.serializers import OwnerOrderStatusUpdateSerializer
from apps.orders.api.throttles import CheckoutOrderRateThrottle
from apps.orders.models import Order
from apps.orders.models import OrderStatus
from apps.orders.models import OrderStatusHistory
from apps.orders.services import notify_order_cancelled
from apps.orders.services import notify_order_status_updated


class CustomerOrderViewSet(ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticatedUser]
    serializer_class = OrderSerializer

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .select_related(
                "restaurant",
                "restaurant__order_capability",
                "status",
                "order_type",
                "fulfillment__delivery_address",
                "fulfillment__table",
            )
            .prefetch_related("items")
            .prefetch_related("status_history__status")
            .order_by("-created_at")
        )


class CheckoutViewSet(GenericViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = CheckoutSerializer
    throttle_classes = [CheckoutOrderRateThrottle]

    def create(self, request):
        serializer = self.get_serializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        url_path=r"guest/(?P<tracking_code>[^/.]+)",
    )
    def guest(self, request, tracking_code=None):
        order = (
            Order.objects.select_related(
                "restaurant",
                "status",
                "order_type",
                "fulfillment__delivery_address",
                "fulfillment__table",
            )
            .prefetch_related("items")
            .prefetch_related("status_history__status")
            .filter(guest_tracking_code=tracking_code)
            .first()
        )
        if not order:
            return Response(
                {"detail": "Pedido no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def status(self, request, pk=None):
        order = (
            Order.objects.select_related(
                "restaurant",
                "status",
                "order_type",
                "fulfillment__delivery_address",
                "fulfillment__table",
            )
            .prefetch_related("items")
            .prefetch_related("status_history__status")
            .filter(pk=pk)
            .first()
        )
        if not order:
            return Response(
                {"detail": "Pedido no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if order.user_id is None:
            return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

        if not request.user.is_authenticated:
            return Response(
                {"detail": "No tienes permiso para consultar este pedido."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if order.user_id != request.user.id:
            return Response(
                {"detail": "No tienes permiso para consultar este pedido."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], permission_classes=[permissions.AllowAny])
    def cancel(self, request, pk=None):
        serializer = OrderCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "").strip()

        order = (
            Order.objects.select_related(
                "restaurant",
                "status",
                "order_type",
                "fulfillment__delivery_address",
                "fulfillment__table",
            )
            .prefetch_related("items")
            .prefetch_related("status_history__status")
            .filter(pk=pk)
            .first()
        )
        if not order:
            return Response(
                {"detail": "Pedido no encontrado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if order.user_id is None:
            cancelled_by = "guest"
        else:
            if not request.user.is_authenticated or order.user_id != request.user.id:
                return Response(
                    {"detail": "No tienes permiso para cancelar este pedido."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            cancelled_by = "customer"

        cancelled_status = OrderStatus.objects.filter(code="cancelled").first()
        if cancelled_status is None:
            return Response(
                {"detail": "La configuracion de cancelacion no esta disponible."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order.status.code in {"delivered", "cancelled"}:
            return Response(
                {"detail": "Este pedido ya no se puede cancelar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = cancelled_status
        order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            order=order,
            status=cancelled_status,
            changed_by=request.user if request.user.is_authenticated else None,
            comment=reason,
        )
        notify_order_cancelled(order, cancelled_by=cancelled_by, reason=reason)
        notify_order_status_updated(order)

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)


class OwnerOrderViewSet(ReadOnlyModelViewSet):
    permission_classes = [PedidosModulePermission]
    serializer_class = OrderSerializer

    def get_queryset(self):
        queryset = (
            Order.objects.select_related(
                "restaurant",
                "status",
                "order_type",
                "fulfillment__delivery_address",
                "fulfillment__table",
            )
            .prefetch_related("items")
            .prefetch_related("status_history__status")
            .order_by("-created_at")
        )
        if is_admin_user(self.request.user):
            return queryset
        restaurant_ids = get_user_owned_or_operated_restaurant_ids(self.request.user)
        return queryset.filter(restaurant_id__in=restaurant_ids)

    @action(detail=True, methods=["patch"])
    def status(self, request, pk=None):
        order = self.get_object()
        serializer = OwnerOrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        next_status = OrderStatus.objects.get(
            code=serializer.validated_data["status_code"],
        )
        order.status = next_status
        order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            order=order,
            status=next_status,
            changed_by=request.user,
        )
        if next_status.code == "delivered":
            assign_points_for_order(order)

        notify_order_status_updated(order)

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["patch"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        serializer = OrderCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get("reason", "").strip()

        cancelled_status = OrderStatus.objects.filter(code="cancelled").first()
        if cancelled_status is None:
            return Response(
                {"detail": "La configuracion de cancelacion no esta disponible."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if order.status.code in {"delivered", "cancelled"}:
            return Response(
                {"detail": "Este pedido ya no se puede cancelar."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = cancelled_status
        order.save(update_fields=["status", "updated_at"])
        OrderStatusHistory.objects.create(
            order=order,
            status=cancelled_status,
            changed_by=request.user,
            comment=reason,
        )
        notify_order_cancelled(order, cancelled_by="owner", reason=reason)
        notify_order_status_updated(order)

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)
