from rest_framework import permissions

from apps.accounts.models import UserRole


def user_id_has_role(user_id, *role_codes: str) -> bool:
    if not user_id:
        return False
    return UserRole.objects.filter(user_id=user_id, role__code__in=role_codes).exists()


def user_has_role(user, *role_codes: str) -> bool:
    if not user or not user.is_authenticated:
        return False
    return user_id_has_role(user.id, *role_codes)


def is_admin_user(user) -> bool:
    return user_has_role(user, "admin")


def is_owner_user(user) -> bool:
    return user_has_role(user, "restaurante")


def is_operator_user(user) -> bool:
    return user_has_role(user, "operador")


def get_operator_restaurant_id(user):
    if not is_operator_user(user):
        return None
    operador = getattr(user, "operador", None)
    return getattr(operador, "restaurante_id", None)


def get_user_owned_or_operated_restaurant_ids(user) -> set:
    if not user or not user.is_authenticated:
        return set()
    if is_admin_user(user):
        return set()

    restaurant_ids = set(user.owned_restaurants.values_list("id", flat=True))
    operated_id = get_operator_restaurant_id(user)
    if operated_id:
        restaurant_ids.add(operated_id)
    return restaurant_ids


class IsAuthenticatedUser(permissions.IsAuthenticated):
    pass


class IsAdminRole(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return is_admin_user(request.user)


class IsOwnerRole(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return is_owner_user(request.user)


class IsOwnerOrAdminRole(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return user_has_role(request.user, "restaurante", "operador", "admin")


class IsOwnerObjectOrAdminRole(permissions.BasePermission):
    owner_field = "owner_id"

    def has_permission(self, request, view) -> bool:
        return user_has_role(request.user, "restaurante", "operador", "admin")

    def has_object_permission(self, request, view, obj) -> bool:
        if is_admin_user(request.user):
            return True

        owner_id = getattr(obj, self.owner_field, None)
        if owner_id == request.user.id:
            return True

        operator_restaurant_id = get_operator_restaurant_id(request.user)
        if not operator_restaurant_id:
            return False
        return getattr(obj, "id", None) == operator_restaurant_id


class IsOwnerOfRestaurantResourceOrAdminRole(permissions.BasePermission):
    restaurant_field = "restaurant"

    def has_permission(self, request, view) -> bool:
        return user_has_role(request.user, "restaurante", "operador", "admin")

    def has_object_permission(self, request, view, obj) -> bool:
        if is_admin_user(request.user):
            return True

        restaurant = getattr(obj, self.restaurant_field, None)
        restaurant_owner_id = getattr(restaurant, "owner_id", None)
        if restaurant_owner_id == request.user.id:
            return True

        operator_restaurant_id = get_operator_restaurant_id(request.user)
        restaurant_id = getattr(restaurant, "id", None)
        return bool(operator_restaurant_id and restaurant_id == operator_restaurant_id)


def operator_can(user, module: str, action: str) -> bool:
    """
    Verifica si un usuario puede realizar una acción en un módulo.
    action: "view" | "create" | "edit" | "delete"
    Propietarios y admins siempre tienen acceso completo.
    """
    if not user or not user.is_authenticated:
        return False
    if is_admin_user(user) or is_owner_user(user):
        return True
    if not is_operator_user(user):
        return False
    operador = getattr(user, "operador", None)
    if not operador:
        return False
    perm = operador.permissions.filter(module=module).first()
    if not perm:
        return False
    return bool(getattr(perm, f"can_{action}", False))


class OperatorModulePermission(permissions.BasePermission):
    """
    Valida que un operador tenga permiso para la acción solicitada en el módulo.
    Mapea el método HTTP a la acción correspondiente.
    Owners y admins siempre pasan (operator_can retorna True para ellos).
    """
    module = ""
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
        if not user_has_role(request.user, "restaurante", "operador", "admin"):
            return False
        action = self._METHOD_ACTION.get(request.method, "view")
        return operator_can(request.user, self.module, action)

    def has_object_permission(self, request, view, obj) -> bool:
        if is_admin_user(request.user):
            return True
        restaurant = getattr(obj, "restaurant", None) or getattr(obj, "restaurante", None)
        if not restaurant:
            return True
        if getattr(restaurant, "owner_id", None) == request.user.id:
            return True
        operator_restaurant_id = get_operator_restaurant_id(request.user)
        return bool(operator_restaurant_id and getattr(restaurant, "id", None) == operator_restaurant_id)


class MenuModulePermission(OperatorModulePermission):
    module = "menu"


class InventarioModulePermission(OperatorModulePermission):
    module = "inventario"


class PedidosModulePermission(OperatorModulePermission):
    module = "pedidos"


class ClientesModulePermission(OperatorModulePermission):
    module = "clientes"


class ResenasModulePermission(OperatorModulePermission):
    module = "resenas"


class ResenasEditPermission(OperatorModulePermission):
    """Para acciones POST que semánticamente son 'editar' (ej: responder reseña)."""
    module = "resenas"
    _METHOD_ACTION = {**OperatorModulePermission._METHOD_ACTION, "POST": "edit"}


class AnaliticasModulePermission(OperatorModulePermission):
    module = "analiticas"


class QrModulePermission(OperatorModulePermission):
    module = "qr"


class PersonalizacionModulePermission(OperatorModulePermission):
    module = "personalizacion"


class ConfiguracionModulePermission(OperatorModulePermission):
    module = "configuracion"
