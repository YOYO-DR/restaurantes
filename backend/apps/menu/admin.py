from django.contrib import admin

from apps.menu.models import InventoryItem
from apps.menu.models import InventoryMovementType
from apps.menu.models import InventoryStockMovement
from apps.menu.models import MenuCategory
from apps.menu.models import MenuItem
from apps.menu.models import MenuItemImage
from apps.menu.models import MenuItemIngredient
from apps.menu.models import MenuItemTag
from apps.menu.models import MenuTag
from apps.menu.models import UnitType

admin.site.register(InventoryItem)
admin.site.register(InventoryMovementType)
admin.site.register(InventoryStockMovement)
admin.site.register(MenuCategory)
admin.site.register(MenuItem)
admin.site.register(MenuItemImage)
admin.site.register(MenuItemIngredient)
admin.site.register(MenuItemTag)
admin.site.register(MenuTag)
admin.site.register(UnitType)
