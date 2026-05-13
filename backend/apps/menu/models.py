from django.conf import settings
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class MenuCategory(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="menu_categories",
    )
    slug = models.SlugField(max_length=120)
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "menu_categories"
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "slug"),
                name="uniq_menu_category_restaurant_slug",
            ),
        ]
        ordering = ("sort_order", "name")


class MenuTag(BaseCatalogModel):
    description = models.TextField(blank=True)


class MenuItem(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="menu_items",
    )
    menu_category = models.ForeignKey(
        MenuCategory,
        on_delete=models.PROTECT,
        related_name="menu_items",
    )
    slug = models.SlugField(max_length=140)
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    price_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency_code = models.CharField(max_length=3, default="COP")
    is_available = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False)
    prep_time_minutes = models.PositiveIntegerField(blank=True, null=True)
    tags = models.ManyToManyField(
        MenuTag,
        through="MenuItemTag",
        related_name="menu_items",
    )

    class Meta:
        db_table = "menu_items"
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "slug"),
                name="uniq_menu_item_restaurant_slug",
            ),
        ]
        indexes = [models.Index(fields=("restaurant", "menu_category", "is_available"))]


class MenuItemTag(BaseModel):
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="menu_item_tags",
    )
    menu_tag = models.ForeignKey(
        MenuTag,
        on_delete=models.CASCADE,
        related_name="menu_item_tags",
    )

    class Meta:
        db_table = "menu_item_tags"
        constraints = [
            models.UniqueConstraint(
                fields=("menu_item", "menu_tag"),
                name="uniq_menu_item_tag",
            ),
        ]


class MenuItemImage(BaseModel):
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image_url = models.URLField(blank=True)
    image_file = models.FileField(upload_to="menu-items/", blank=True)
    sort_order = models.IntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "menu_item_images"


class UnitType(BaseCatalogModel):
    description = models.TextField(blank=True)


class InventoryMovementType(BaseCatalogModel):
    description = models.TextField(blank=True)


class InventoryItem(BaseModel):
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="inventory_items",
    )
    sku = models.CharField(max_length=60, blank=True)
    name = models.CharField(max_length=160)
    unit_type = models.ForeignKey(
        UnitType,
        on_delete=models.PROTECT,
        related_name="inventory_items",
    )
    current_stock = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    min_stock = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        blank=True,
        null=True,
    )
    max_stock = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        blank=True,
        null=True,
    )

    class Meta:
        db_table = "inventory_items"
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "sku"),
                name="uniq_inventory_item_restaurant_sku",
            ),
        ]
        indexes = [models.Index(fields=("restaurant", "current_stock"))]


class InventoryStockMovement(BaseModel):
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="movements",
    )
    movement_type = models.ForeignKey(
        InventoryMovementType,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    reason = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_movements",
    )

    class Meta:
        db_table = "inventory_stock_movements"


class MenuItemIngredient(BaseModel):
    menu_item = models.ForeignKey(
        MenuItem,
        on_delete=models.CASCADE,
        related_name="ingredients",
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="menu_ingredients",
    )
    quantity_required = models.DecimalField(max_digits=14, decimal_places=3)

    class Meta:
        db_table = "menu_item_ingredients"
        constraints = [
            models.UniqueConstraint(
                fields=("menu_item", "inventory_item"),
                name="uniq_menu_item_ingredient",
            ),
        ]
