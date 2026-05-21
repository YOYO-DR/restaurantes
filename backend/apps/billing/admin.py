from django.contrib import admin

from apps.billing.models import Feature
from apps.billing.models import FeatureDependency
from apps.billing.models import Plan
from apps.billing.models import PlanChangeRequest
from apps.billing.models import PlanFeature
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.models import SubscriptionEvent
from apps.billing.models import TrialConfig
from apps.billing.models import TrialFeatureDefault


class FeatureDependencyInline(admin.TabularInline):
    model = FeatureDependency
    fk_name = "feature"
    extra = 1


class PlanFeatureInline(admin.TabularInline):
    model = PlanFeature
    extra = 0


class TrialFeatureDefaultInline(admin.TabularInline):
    model = TrialFeatureDefault
    extra = 0


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "is_active", "sort_order")
    list_filter = ("is_active", "category")
    search_fields = ("code", "name")
    inlines = (FeatureDependencyInline,)


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "price_amount", "is_free", "is_default", "is_active", "sort_order")
    list_filter = ("is_active", "is_free", "is_default")
    search_fields = ("code", "name")
    inlines = (PlanFeatureInline,)


@admin.register(TrialConfig)
class TrialConfigAdmin(admin.ModelAdmin):
    list_display = ("is_enabled", "default_trial_days", "trial_plan")
    inlines = (TrialFeatureDefaultInline,)


@admin.register(RestaurantSubscription)
class RestaurantSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "plan", "status", "trial_end", "current_period_end", "cancelled_at")
    list_filter = ("status",)
    search_fields = ("restaurant__display_name",)
    raw_id_fields = ("restaurant",)
    readonly_fields = ("provider_subscription_id", "payment_provider", "metadata")


@admin.register(RestaurantFeatureOverride)
class RestaurantFeatureOverrideAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "feature", "source", "can_view", "can_create", "can_edit", "can_delete", "expires_at")
    list_filter = ("source",)
    raw_id_fields = ("restaurant",)


@admin.register(PlanChangeRequest)
class PlanChangeRequestAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "requested_plan", "current_plan", "request_type", "status", "created_at")
    list_filter = ("status", "request_type")
    search_fields = ("restaurant__display_name",)
    raw_id_fields = ("restaurant",)


@admin.register(SubscriptionEvent)
class SubscriptionEventAdmin(admin.ModelAdmin):
    list_display = ("restaurant", "event_type", "old_plan", "new_plan", "actor", "created_at")
    list_filter = ("event_type",)
    search_fields = ("restaurant__display_name",)
    raw_id_fields = ("restaurant",)
