from rest_framework import permissions

from apps.core.permissions import is_admin_user
from apps.core.permissions import is_owner_user
from apps.core.permissions import get_operator_restaurant_id


def plan_can(user, feature_code: str, action: str) -> bool:
    """
    Verifica si el usuario puede realizar la acción en el feature según su plan.
    action: "view" | "create" | "edit" | "delete"
    Admin siempre tiene acceso completo. Usuarios sin restaurante: False.
    """
    if not user or not user.is_authenticated:
        return False
    if is_admin_user(user):
        return True

    restaurant_id = _get_restaurant_id_for_user(user)
    if not restaurant_id:
        return False

    from apps.billing.services.features import check_feature_access
    return check_feature_access(restaurant_id, feature_code, action)


def _get_restaurant_id_for_user(user):
    if is_owner_user(user):
        first = user.owned_restaurants.values_list("id", flat=True).first()
        return first
    rid = get_operator_restaurant_id(user)
    return rid


def effective_can(user, restaurant, feature_code: str, action: str) -> bool:
    """
    AND of operator permission + plan feature permission.
    For use in service layer (not DRF permission classes).
    """
    from apps.core.permissions import operator_can
    return operator_can(user, feature_code, action) and plan_can(user, feature_code, action)


class PlanFeaturePermission(permissions.BasePermission):
    """
    Base class for plan feature permissions. Mirrors OperatorModulePermission pattern.
    Admins always pass. Maps HTTP method to action.
    """
    feature = ""
    _METHOD_ACTION = {
        "GET": "view",
        "HEAD": "view",
        "OPTIONS": "view",
        "POST": "create",
        "PUT": "edit",
        "PATCH": "edit",
        "DELETE": "delete",
    }

    def has_permission(self, request, view) -> bool:
        if is_admin_user(request.user):
            return True
        action = self._METHOD_ACTION.get(request.method, "view")
        return plan_can(request.user, self.feature, action)

    def has_object_permission(self, request, view, obj) -> bool:
        if is_admin_user(request.user):
            return True
        action = self._METHOD_ACTION.get(request.method, "view")
        return plan_can(request.user, self.feature, action)


class MenuPlanPermission(PlanFeaturePermission):
    feature = "menu"


class PedidosPlanPermission(PlanFeaturePermission):
    feature = "pedidos"


class InventarioPlanPermission(PlanFeaturePermission):
    feature = "inventario"


class ClientesPlanPermission(PlanFeaturePermission):
    feature = "clientes"


class LealtadPlanPermission(PlanFeaturePermission):
    feature = "lealtad"


class ResenasPlanPermission(PlanFeaturePermission):
    feature = "resenas"


class AnaliticasPlanPermission(PlanFeaturePermission):
    feature = "analiticas"


class QrPlanPermission(PlanFeaturePermission):
    feature = "qr"


class PersonalizacionPlanPermission(PlanFeaturePermission):
    feature = "personalizacion"


class ConfiguracionPlanPermission(PlanFeaturePermission):
    feature = "configuracion"


class OperadoresPlanPermission(PlanFeaturePermission):
    feature = "operadores"
