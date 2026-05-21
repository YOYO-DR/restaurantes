from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import BaseModel
from apps.platform_config.models import BillingPeriod


class Feature(BaseModel):
    code = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=60, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "billing_features"
        ordering = ("sort_order", "name")

    def __str__(self):
        return self.name


class FeatureDependency(BaseModel):
    feature = models.ForeignKey(
        Feature,
        on_delete=models.CASCADE,
        related_name="dependencies",
    )
    depends_on = models.ForeignKey(
        Feature,
        on_delete=models.CASCADE,
        related_name="required_by",
    )

    class Meta:
        db_table = "billing_feature_dependencies"
        constraints = [
            models.UniqueConstraint(
                fields=("feature", "depends_on"),
                name="uniq_feature_dependency",
            ),
            models.CheckConstraint(
                condition=~models.Q(feature=models.F("depends_on")),
                name="no_self_dependency",
            ),
        ]

    def clean(self):
        if self.feature_id and self.depends_on_id and self.feature_id == self.depends_on_id:
            raise ValidationError("Una feature no puede depender de sí misma.")

    def __str__(self):
        return f"{self.feature} → {self.depends_on}"


class Plan(BaseModel):
    code = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    billing_period = models.ForeignKey(
        BillingPeriod,
        on_delete=models.PROTECT,
        related_name="billing_plans",
        null=True,
        blank=True,
    )
    price_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency_code = models.CharField(max_length=3, default="COP")
    is_free = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "billing_plans"
        ordering = ("sort_order", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("is_free",),
                condition=models.Q(is_free=True, is_active=True),
                name="uniq_active_free_plan",
            ),
            models.UniqueConstraint(
                fields=("is_default",),
                condition=models.Q(is_default=True),
                name="uniq_default_plan",
            ),
        ]

    def __str__(self):
        return self.name


class PlanFeature(BaseModel):
    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        related_name="plan_features",
    )
    feature = models.ForeignKey(
        Feature,
        on_delete=models.CASCADE,
        related_name="plan_features",
    )
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    class Meta:
        db_table = "billing_plan_features"
        constraints = [
            models.UniqueConstraint(
                fields=("plan", "feature"),
                name="uniq_plan_feature",
            ),
        ]

    def __str__(self):
        return f"{self.plan} / {self.feature}"


class TrialConfig(BaseModel):
    is_enabled = models.BooleanField(default=True)
    default_trial_days = models.PositiveSmallIntegerField(default=14)
    trial_plan = models.ForeignKey(
        Plan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="trial_configs",
    )

    class Meta:
        db_table = "billing_trial_config"
        constraints = [
            models.UniqueConstraint(
                fields=("is_enabled",),
                condition=models.Q(is_enabled=True),
                name="uniq_trial_config_enabled_true",
            ),
            models.UniqueConstraint(
                fields=("is_enabled",),
                condition=models.Q(is_enabled=False),
                name="uniq_trial_config_enabled_false",
            ),
        ]

    def clean(self):
        if not self._state.adding and TrialConfig.objects.exclude(pk=self.pk).exists():
            raise ValidationError("Solo puede existir un TrialConfig (singleton).")

    def save(self, *args, **kwargs):
        from django.db import transaction

        if self._state.adding:
            with transaction.atomic():
                if TrialConfig.objects.select_for_update().exists():
                    raise ValidationError("Solo puede existir un TrialConfig (singleton).")
                super().save(*args, **kwargs)
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"TrialConfig ({self.default_trial_days} días)"


class TrialFeatureDefault(BaseModel):
    trial_config = models.ForeignKey(
        TrialConfig,
        on_delete=models.CASCADE,
        related_name="trial_feature_defaults",
    )
    feature = models.ForeignKey(
        Feature,
        on_delete=models.CASCADE,
        related_name="trial_feature_defaults",
    )
    can_view = models.BooleanField(default=True)
    can_create = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=True)
    can_delete = models.BooleanField(default=False)

    class Meta:
        db_table = "billing_trial_feature_defaults"
        constraints = [
            models.UniqueConstraint(
                fields=("trial_config", "feature"),
                name="uniq_trial_feature_default",
            ),
        ]

    def __str__(self):
        return f"TrialDefault {self.feature}"


class RestaurantSubscription(BaseModel):
    STATUS_TRIAL = "trial"
    STATUS_ACTIVE = "active"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_CHOICES = [
        (STATUS_TRIAL, "Trial"),
        (STATUS_ACTIVE, "Activa"),
        (STATUS_CANCELLED, "Cancelada"),
        (STATUS_EXPIRED, "Expirada"),
    ]

    restaurant = models.OneToOneField(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name="subscriptions",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_TRIAL,
    )
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end = models.DateTimeField(null=True, blank=True)
    override_trial_days = models.PositiveSmallIntegerField(null=True, blank=True)
    current_period_start = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    scheduled_downgrade_to = models.ForeignKey(
        Plan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheduled_downgrades",
    )
    auto_renew = models.BooleanField(default=True)
    payment_provider = models.CharField(max_length=60, blank=True)
    provider_subscription_id = models.CharField(max_length=200, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "billing_restaurant_subscriptions"

    def __str__(self):
        return f"Sub {self.restaurant} → {self.plan} ({self.status})"


class RestaurantFeatureOverride(BaseModel):
    SOURCE_ADMIN = "admin"
    SOURCE_TRIAL = "trial"
    SOURCE_LEGACY = "legacy"
    SOURCE_CHOICES = [
        (SOURCE_ADMIN, "Admin"),
        (SOURCE_TRIAL, "Trial"),
        (SOURCE_LEGACY, "Legacy"),
    ]

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="feature_overrides",
    )
    feature = models.ForeignKey(
        Feature,
        on_delete=models.CASCADE,
        related_name="restaurant_overrides",
    )
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_ADMIN)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "billing_restaurant_feature_overrides"
        constraints = [
            models.UniqueConstraint(
                fields=("restaurant", "feature"),
                name="uniq_restaurant_feature_override",
            ),
        ]

    def __str__(self):
        return f"Override {self.restaurant} / {self.feature} ({self.source})"


class PlanChangeRequest(BaseModel):
    TYPE_UPGRADE = "upgrade"
    TYPE_DOWNGRADE = "downgrade"
    TYPE_CHOICES = [
        (TYPE_UPGRADE, "Upgrade"),
        (TYPE_DOWNGRADE, "Downgrade"),
    ]

    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_SUPERSEDED = "superseded"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pendiente"),
        (STATUS_APPROVED, "Aprobada"),
        (STATUS_REJECTED, "Rechazada"),
        (STATUS_SUPERSEDED, "Supersedida"),
    ]

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="plan_change_requests",
    )
    requested_plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name="change_requests_to",
    )
    current_plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name="change_requests_from",
    )
    request_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="plan_requests_made",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="plan_requests_decided",
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "billing_plan_change_requests"

    def __str__(self):
        return f"Request {self.restaurant} → {self.requested_plan} ({self.status})"


class SubscriptionEvent(BaseModel):
    EVENT_TRIAL_STARTED = "trial_started"
    EVENT_TRIAL_EXPIRED = "trial_expired"
    EVENT_PLAN_CHANGED = "plan_changed"
    EVENT_SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    EVENT_SUBSCRIPTION_DOWNGRADED = "subscription_downgraded"
    EVENT_REQUEST_CREATED = "request_created"
    EVENT_REQUEST_APPROVED = "request_approved"
    EVENT_REQUEST_REJECTED = "request_rejected"
    EVENT_OVERRIDE_SET = "override_set"
    EVENT_CHOICES = [
        (EVENT_TRIAL_STARTED, "Trial iniciado"),
        (EVENT_TRIAL_EXPIRED, "Trial expirado"),
        (EVENT_PLAN_CHANGED, "Plan cambiado"),
        (EVENT_SUBSCRIPTION_CANCELLED, "Suscripción cancelada"),
        (EVENT_SUBSCRIPTION_DOWNGRADED, "Suscripción degradada"),
        (EVENT_REQUEST_CREATED, "Solicitud creada"),
        (EVENT_REQUEST_APPROVED, "Solicitud aprobada"),
        (EVENT_REQUEST_REJECTED, "Solicitud rechazada"),
        (EVENT_OVERRIDE_SET, "Override establecido"),
    ]

    restaurant = models.ForeignKey(
        "restaurants.Restaurant",
        on_delete=models.CASCADE,
        related_name="subscription_events",
    )
    event_type = models.CharField(max_length=60, choices=EVENT_CHOICES)
    old_plan = models.ForeignKey(
        Plan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events_from",
    )
    new_plan = models.ForeignKey(
        Plan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events_to",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subscription_events_acted",
    )
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "billing_subscription_events"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Event {self.event_type} @ {self.restaurant}"
