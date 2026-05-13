from django.conf import settings
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class OrderType(BaseCatalogModel):
    description = models.TextField(blank=True)


class OrderStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class PaymentStatus(BaseCatalogModel):
    description = models.TextField(blank=True)


class Order(BaseModel):
    order_code = models.CharField(max_length=40, unique=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="orders",
        null=True,
        blank=True,
    )
    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    order_type = models.ForeignKey(
        OrderType,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    status = models.ForeignKey(
        OrderStatus,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    subtotal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    delivery_fee_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    service_fee_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency_code = models.CharField(max_length=3, default="COP")
    customer_notes = models.TextField(blank=True)
    customer_name = models.CharField(max_length=255, blank=True)
    customer_email = models.EmailField(blank=True)
    customer_phone = models.CharField(max_length=30, blank=True)
    guest_tracking_code = models.UUIDField(
        unique=True,
        null=True,
        blank=True,
        editable=False,
        default=None,
    )

    class Meta:
        db_table = "orders"
        indexes = [
            models.Index(fields=("restaurant", "status", "created_at")),
            models.Index(fields=("user", "created_at")),
        ]


class OrderItem(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )
    item_name_snapshot = models.CharField(max_length=180)
    unit_price_amount = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.PositiveIntegerField()
    line_total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        db_table = "order_items"


class OrderFulfillment(BaseModel):
    order = models.OneToOneField(
        Order,
        on_delete=models.CASCADE,
        related_name="fulfillment",
    )
    delivery_address = models.ForeignKey(
        "customers.CustomerAddress",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_fulfillments",
    )
    table = models.ForeignKey(
        "restaurants.RestaurantTable",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_fulfillments",
    )
    delivery_address_text = models.CharField(max_length=255, blank=True)
    estimated_min_minutes = models.PositiveIntegerField(blank=True, null=True)
    estimated_max_minutes = models.PositiveIntegerField(blank=True, null=True)
    delivered_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "order_fulfillments"


class OrderStatusHistory(BaseModel):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="status_history",
    )
    status = models.ForeignKey(
        OrderStatus,
        on_delete=models.PROTECT,
        related_name="status_changes",
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_status_changes",
    )
    comment = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "order_status_history"
        indexes = [models.Index(fields=("order", "changed_at"))]


class OrderPaymentTransaction(BaseModel):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="payment_transactions",
    )
    payment_method_type = models.ForeignKey(
        "customers.PaymentMethodType",
        on_delete=models.PROTECT,
        related_name="order_payment_transactions",
    )
    payment_status = models.ForeignKey(
        PaymentStatus,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    provider_name = models.CharField(max_length=80, blank=True)
    provider_reference = models.CharField(max_length=120, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency_code = models.CharField(max_length=3, default="COP")
    paid_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "order_payment_transactions"
