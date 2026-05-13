from django.db import models

from apps.core.models import BaseCatalogModel
from apps.core.models import BaseModel


class BillingPeriod(BaseCatalogModel):
    description = models.TextField(blank=True)


class BackupFrequency(BaseCatalogModel):
    description = models.TextField(blank=True)


class SubscriptionPlan(BaseCatalogModel):
    billing_period = models.ForeignKey(
        BillingPeriod,
        on_delete=models.PROTECT,
        related_name="subscription_plans",
    )
    price_amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency_code = models.CharField(max_length=3)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "platform_subscription_plans"


class PlatformSetting(BaseModel):
    platform_name = models.CharField(max_length=140)
    support_email = models.EmailField(blank=True)
    support_phone = models.CharField(max_length=30, blank=True)
    support_address = models.TextField(blank=True)
    default_currency_code = models.CharField(max_length=3, default="COP")
    default_locale = models.CharField(max_length=20, default="es-CO")
    maintenance_mode = models.BooleanField(default=False)

    class Meta:
        db_table = "platform_settings"


class PlatformSecuritySetting(BaseModel):
    require_2fa_admin = models.BooleanField(default=False)
    require_restaurant_verification = models.BooleanField(default=True)
    encrypt_payment_data = models.BooleanField(default=True)
    backup_frequency = models.ForeignKey(
        BackupFrequency,
        on_delete=models.PROTECT,
        related_name="security_settings",
    )
    backup_retention_days = models.PositiveIntegerField(default=30)

    class Meta:
        db_table = "platform_security_settings"
