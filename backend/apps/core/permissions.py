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
        return user_has_role(request.user, "restaurante", "admin")


class IsOwnerObjectOrAdminRole(permissions.BasePermission):
    owner_field = "owner_id"

    def has_permission(self, request, view) -> bool:
        return user_has_role(request.user, "restaurante", "admin")

    def has_object_permission(self, request, view, obj) -> bool:
        if is_admin_user(request.user):
            return True
        return getattr(obj, self.owner_field, None) == request.user.id


class IsOwnerOfRestaurantResourceOrAdminRole(permissions.BasePermission):
    restaurant_field = "restaurant"

    def has_permission(self, request, view) -> bool:
        return user_has_role(request.user, "restaurante", "admin")

    def has_object_permission(self, request, view, obj) -> bool:
        if is_admin_user(request.user):
            return True

        restaurant = getattr(obj, self.restaurant_field, None)
        restaurant_owner_id = getattr(restaurant, "owner_id", None)
        return restaurant_owner_id == request.user.id
