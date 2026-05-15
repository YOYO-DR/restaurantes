from __future__ import annotations

import uuid

from rest_framework.permissions import BasePermission

from apps.core.permissions import is_admin_user
from apps.core.permissions import is_owner_user
from apps.restaurants.models import Operador


def order_chat_group(order_id) -> str:
    return f"order-chat-{order_id}"


def is_restaurant_member(user, restaurant_id) -> bool:
    if not user or not user.is_authenticated:
        return False
    if is_admin_user(user):
        return True
    if is_owner_user(user):
        return user.owned_restaurants.filter(id=restaurant_id).exists()

    operador = (
        Operador.objects.select_related("restaurante")
        .prefetch_related("permissions")
        .filter(user_id=user.id, restaurante_id=restaurant_id)
        .first()
    )
    if not operador:
        return False

    permission = operador.permissions.filter(module="pedidos").first()
    return bool(permission and permission.can_view)


def get_tracking_code_from_request(request) -> str:
    return str(
        request.query_params.get("tracking_code")
        or request.data.get("tracking_code")
        or "",
    ).strip()


def has_order_chat_access(order, user, tracking_code: str = "") -> bool:
    if user and user.is_authenticated:
        if order.user_id == user.id:
            return True
        if is_restaurant_member(user, order.restaurant_id):
            return True

    if order.user_id is not None:
        return False

    if not tracking_code:
        return False

    try:
        parsed_tracking_code = uuid.UUID(str(tracking_code))
    except (TypeError, ValueError):
        return False
    return parsed_tracking_code == order.guest_tracking_code


class OrderChatAccessPermission(BasePermission):
    def has_permission(self, request, view) -> bool:
        return True

    def has_object_permission(self, request, view, order) -> bool:
        tracking_code = get_tracking_code_from_request(request)
        return has_order_chat_access(order, request.user, tracking_code)
