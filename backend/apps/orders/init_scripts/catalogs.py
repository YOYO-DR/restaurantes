from apps.orders.models import OrderStatus
from apps.orders.models import OrderType

REQUIRED_ORDER_TYPES = (
    ("delivery", "Delivery"),
    ("pickup", "Pickup"),
    ("table", "Mesa"),
)

REQUIRED_ORDER_STATUSES = (
    ("new", "Nuevo"),
    ("preparing", "Preparando"),
    ("ready", "Listo"),
    ("delivered", "Entregado"),
    ("completed", "Completado"),
    ("cancelled", "Cancelado"),
)


def ensure_order_catalogs() -> None:
    for code, name in REQUIRED_ORDER_TYPES:
        OrderType.objects.update_or_create(code=code, defaults={"name": name})

    for code, name in REQUIRED_ORDER_STATUSES:
        OrderStatus.objects.update_or_create(code=code, defaults={"name": name})
