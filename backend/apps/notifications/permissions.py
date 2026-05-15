from __future__ import annotations

from dataclasses import dataclass

from django.core.cache import cache

from apps.accounts.models import UserRole
from apps.restaurants.models import OPERATOR_MODULES
from apps.restaurants.models import Operador

NOTIFICATION_MODULES = (
    "pedidos",
    "menu",
    "inventario",
    "clientes",
    "resenas",
    "analiticas",
    "configuracion",
)
CACHE_TTL_SECONDS = 30


def restaurant_group(restaurant_id, module: str) -> str:
    return f"r-{restaurant_id}-{module}"


def user_group(user_id) -> str:
    return f"u-{user_id}"


def guest_order_group(order_id) -> str:
    return f"g-{order_id}"


def operator_permissions_cache_key(user_id) -> str:
    return f"notifications:operator_permissions:{user_id}"


def _owned_restaurant_ids(user_id) -> list[str]:
    from apps.restaurants.models import Restaurant

    return [str(item) for item in Restaurant.objects.filter(owner_id=user_id).values_list("id", flat=True)]


def _role_codes_for_user(user_id) -> set[str]:
    return set(
        UserRole.objects.filter(user_id=user_id).values_list("role__code", flat=True),
    )


def _operator_permissions_payload(user_id) -> dict[str, object]:
    try:
        operator = Operador.objects.select_related("restaurante", "user").prefetch_related(
            "permissions",
        ).get(user_id=user_id)
    except Operador.DoesNotExist:
        return {
            "restaurant_id": None,
            "is_active": False,
            "modules": {module: False for module in OPERATOR_MODULES},
        }

    modules = {module: False for module in OPERATOR_MODULES}
    for permission in operator.permissions.all():
        modules[permission.module] = bool(permission.can_view)

    return {
        "restaurant_id": str(operator.restaurante_id),
        "is_active": bool(operator.user.is_active),
        "modules": modules,
    }


def get_operator_permissions_payload(user_id) -> dict[str, object]:
    key = operator_permissions_cache_key(user_id)
    payload = cache.get(key)
    if payload is not None:
        return payload

    payload = _operator_permissions_payload(user_id)
    cache.set(key, payload, CACHE_TTL_SECONDS)
    return payload


def resolve_active_role(user, requested_role: str = "") -> str:
    roles = _role_codes_for_user(user.id)
    normalized = (requested_role or "").strip()

    if normalized == "dueno":
        normalized = "restaurante"

    if normalized in roles:
        return normalized

    if "cliente" in roles:
        return "cliente"
    if "restaurante" in roles:
        return "restaurante"
    if "operador" in roles:
        return "operador"
    if "admin" in roles:
        return "admin"

    return "cliente"


@dataclass
class GroupResolution:
    role: str
    groups: set[str]


def groups_for_user(user, active_role: str = "") -> GroupResolution:
    groups = {user_group(user.id)}
    role = resolve_active_role(user, active_role)

    if role in {"admin", "restaurante"}:
        for restaurant_id in _owned_restaurant_ids(user.id):
            for module in NOTIFICATION_MODULES:
                groups.add(restaurant_group(restaurant_id, module))
        return GroupResolution(role=role, groups=groups)

    if role == "operador":
        payload = get_operator_permissions_payload(user.id)
        restaurant_id = payload.get("restaurant_id")
        modules = payload.get("modules") or {}

        if restaurant_id:
            for module in NOTIFICATION_MODULES:
                if bool(modules.get(module)):
                    groups.add(restaurant_group(restaurant_id, module))

    return GroupResolution(role=role, groups=groups)


def can_user_receive_module(user, module: str, active_role: str = "") -> bool:
    if module not in NOTIFICATION_MODULES:
        return False

    role = resolve_active_role(user, active_role)
    if role in {"admin", "restaurante"}:
        return True

    if role == "operador":
        payload = get_operator_permissions_payload(user.id)
        modules = payload.get("modules") or {}
        return bool(modules.get(module))

    return False


def is_operator_session_active(user_id) -> bool:
    payload = get_operator_permissions_payload(user_id)
    return bool(payload.get("restaurant_id") and payload.get("is_active"))
