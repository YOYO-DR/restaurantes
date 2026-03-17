from django.conf import settings
from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class AddressType(BaseCatalogModel):
    description = models.TextField(blank=True)


class PaymentMethodType(BaseCatalogModel):
    description = models.TextField(blank=True)


class CustomerAddress(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_addresses",
    )
    address_type = models.ForeignKey(
        AddressType, on_delete=models.PROTECT, related_name="customer_addresses"
    )
    label = models.CharField(max_length=80, blank=True)
    line1 = models.CharField(max_length=220)
    line2 = models.CharField(max_length=220, blank=True)
    city = models.CharField(max_length=120)
    state = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=120)
    latitude = models.DecimalField(
        max_digits=10, decimal_places=7, blank=True, null=True
    )
    longitude = models.DecimalField(
        max_digits=10, decimal_places=7, blank=True, null=True
    )
    notes = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "customer_addresses"


class CustomerPaymentMethod(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_payment_methods",
    )
    payment_method_type = models.ForeignKey(
        PaymentMethodType,
        on_delete=models.PROTECT,
        related_name="customer_payment_methods",
    )
    provider_token = models.CharField(max_length=255)
    masked_number = models.CharField(max_length=30, blank=True)
    brand = models.CharField(max_length=40, blank=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "customer_payment_methods"


class Favorite(BaseModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    restaurant = models.ForeignKey(
        "restaurants.Restaurant", on_delete=models.CASCADE, related_name="favorites"
    )

    class Meta:
        db_table = "customer_favorites"
        constraints = [
            models.UniqueConstraint(
                fields=("user", "restaurant"), name="uniq_customer_favorite"
            ),
        ]
