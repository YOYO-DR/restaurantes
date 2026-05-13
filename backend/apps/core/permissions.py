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
