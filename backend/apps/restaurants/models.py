import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator
from django.core.validators import MinValueValidator
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class RestaurantStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class RestaurantCategory(BaseCatalogModel):
    description = models.TextField(blank=True)


class TableStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class MenuLayoutOption(BaseCatalogModel):
    description = models.TextField(blank=True)


class CategoryNavigationStyle(BaseCatalogModel):
    description = models.TextField(blank=True)


class CartPosition(BaseCatalogModel):
    description = models.TextField(blank=True)


class QrTargetType(BaseCatalogModel):
    description = models.TextField(blank=True)


class Restaurant(BaseModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_restaurants",
    )
    category = models.ForeignKey(
        RestaurantCategory,
        on_delete=models.PROTECT,
        related_name="restaurants",
    )
    subscription_plan = models.ForeignKey(
        "platform_config.SubscriptionPlan",
        on_delete=models.PROTECT,
        related_name="restaurants",
    )
    status = models.ForeignKey(
        RestaurantStatus,
        on_delete=models.PROTECT,
        related_name="restaurants",
    )
    slug = models.SlugField(max_length=160, unique=True)
    display_name = models.CharField(max_length=180)
    legal_name = models.CharField(max_length=180, blank=True)
    nit = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    currency_code = models.CharField(max_length=3, default="COP")
    description = models.TextField(blank=True)
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_reviews = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "restaurants"
        indexes = [
            models.Index(fields=("status",)),
            models.Index(fields=("owner",)),
        ]


class RestaurantAddress(BaseModel):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    line1 = models.CharField(max_length=220)
    line2 = models.CharField(max_length=220, blank=True)
    city = models.CharField(max_length=120)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120)
    postal_code = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        blank=True,
        null=True,
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        blank=True,
        null=True,
    )
    is_primary = models.BooleanField(default=True)

    class Meta:
        db_table = "restaurant_addresses"


class RestaurantHour(BaseModel):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="hours",
    )
    weekday = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(6)],
    )
    open_time = models.TimeField(blank=True, null=True)
    close_time = models.TimeField(blank=True, null=True)
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = "restaurant_hours"
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "weekday"),
                name="uniq_restaurant_weekday",
            ),
        ]


class RestaurantOrderCapability(BaseModel):
    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="order_capability",
    )
    delivery_enabled = models.BooleanField(default=True)
    pickup_enabled = models.BooleanField(default=True)
    table_order_enabled = models.BooleanField(default=False)

    class Meta:
        db_table = "restaurant_order_capabilities"


class RestaurantDeliverySetting(BaseModel):
    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="delivery_setting",
    )
    delivery_fee_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    free_delivery_from_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
    )
    min_order_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        blank=True,
        null=True,
    )
    estimated_min_minutes = models.PositiveIntegerField(blank=True, null=True)
    estimated_max_minutes = models.PositiveIntegerField(blank=True, null=True)
    coverage_radius_km = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        blank=True,
        null=True,
    )

    class Meta:
        db_table = "restaurant_delivery_settings"


class RestaurantReview(BaseModel):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="reviews",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="restaurant_reviews",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviews",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)
    owner_reply = models.TextField(blank=True)
    owner_replied_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "restaurant_reviews"
        indexes = [
            models.Index(fields=("restaurant", "created_at")),
            models.Index(fields=("restaurant", "rating")),
        ]


class RestaurantPaymentSetting(BaseModel):
    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="payment_setting",
    )
    card_enabled = models.BooleanField(default=True)
    pse_enabled = models.BooleanField(default=False)
    cash_enabled = models.BooleanField(default=True)
    nequi_enabled = models.BooleanField(default=False)
    invoice_enabled = models.BooleanField(default=False)
    invoice_prefix = models.CharField(max_length=20, blank=True)

    class Meta:
        db_table = "restaurant_payment_settings"


class RestaurantBranding(BaseModel):
    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="branding",
    )
    logo_url = models.URLField(blank=True)
    logo_file = models.FileField(upload_to="restaurant-branding/", blank=True)
    cover_url = models.URLField(blank=True)
    cover_file = models.FileField(upload_to="restaurant-branding/", blank=True)
    primary_color = models.CharField(max_length=15, blank=True)
    secondary_color = models.CharField(max_length=15, blank=True)
    slogan = models.CharField(max_length=180, blank=True)
    welcome_message = models.TextField(blank=True)
    menu_layout_option = models.ForeignKey(
        MenuLayoutOption,
        on_delete=models.PROTECT,
        related_name="brandings",
    )
    category_navigation_style = models.ForeignKey(
        CategoryNavigationStyle,
        on_delete=models.PROTECT,
        related_name="brandings",
    )
    cart_position = models.ForeignKey(
        CartPosition,
        on_delete=models.PROTECT,
        related_name="brandings",
    )
    image_size = models.CharField(max_length=20, default="medium")
    show_prices = models.BooleanField(default=True)
    show_descriptions = models.BooleanField(default=True)
    show_tags = models.BooleanField(default=True)
    search_enabled = models.BooleanField(default=True)
    filters_enabled = models.BooleanField(default=False)
    dark_mode_enabled = models.BooleanField(default=False)

    class Meta:
        db_table = "restaurant_brandings"


class RestaurantSocialLink(BaseModel):
    restaurant = models.OneToOneField(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="social_links",
    )
    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)
    tiktok_url = models.URLField(blank=True)
    whatsapp_number = models.CharField(max_length=30, blank=True)

    class Meta:
        db_table = "restaurant_social_links"


class RestaurantTable(BaseModel):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="tables",
    )
    table_number = models.CharField(max_length=20)
    capacity = models.PositiveIntegerField()
    status = models.ForeignKey(
        TableStatus,
        on_delete=models.PROTECT,
        related_name="tables",
    )

    class Meta:
        db_table = "restaurant_tables"
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "table_number"),
                name="uniq_restaurant_table_number",
            ),
        ]


class QrCode(BaseModel):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="qr_codes",
    )
    target_type = models.ForeignKey(
        QrTargetType,
        on_delete=models.PROTECT,
        related_name="qr_codes",
    )
    target_id = models.UUIDField(blank=True, null=True)
    qr_url = models.URLField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "restaurant_qr_codes"


class Operador(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="operador",
    )
    restaurante = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="operadores",
    )

    class Meta:
        db_table = "restaurant_operadores"

    def __str__(self):
        return f"Operador {self.user.username} para {self.restaurante.display_name}"


OPERATOR_MODULES = [
    "pedidos",
    "menu",
    "inventario",
    "clientes",
    "resenas",
    "analiticas",
    "qr",
    "personalizacion",
    "configuracion",
]


class OperatorPermission(BaseModel):
    operator = models.ForeignKey(
        Operador,
        on_delete=models.CASCADE,
        related_name="permissions",
    )
    module = models.CharField(max_length=50)
    can_view = models.BooleanField(default=True)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        db_table = "restaurant_operator_permissions"
        constraints = [
            models.UniqueConstraint(
                fields=("operator", "module"),
                name="uniq_operator_module_permission",
            )
        ]

    def __str__(self):
        return f"Permisos de {self.operator} en {self.module}"


class OperatorInvitation(BaseModel):
    restaurant = models.ForeignKey(
        Restaurant,
        on_delete=models.CASCADE,
        related_name="operator_invitations",
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_operator_invitations",
    )
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    accepted_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField()
    permissions_snapshot = models.JSONField(default=dict)

    class Meta:
        db_table = "restaurant_operator_invitations"

    def __str__(self):
        return f"Invitacion a {self.email} para {self.restaurant.display_name}"
