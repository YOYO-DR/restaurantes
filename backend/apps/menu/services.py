from apps.menu.models import InventoryMovementType
from apps.menu.models import UnitType

DEFAULT_UNIT_TYPES = [
    ("g", "Gramos"),
    ("kg", "Kilogramos"),
    ("ml", "Mililitros"),
    ("l", "Litros"),
    ("unit", "Unidades"),
]

DEFAULT_INVENTORY_MOVEMENT_TYPES = [
    ("stock_in", "Entrada"),
    ("stock_out", "Salida"),
    ("stock_adjustment", "Ajuste"),
]


def ensure_inventory_catalogs() -> None:
    for code, name in DEFAULT_UNIT_TYPES:
        UnitType.objects.get_or_create(code=code, defaults={"name": name})

    for code, name in DEFAULT_INVENTORY_MOVEMENT_TYPES:
        InventoryMovementType.objects.get_or_create(
            code=code,
            defaults={"name": name},
        )
