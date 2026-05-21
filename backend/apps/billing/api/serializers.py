from rest_framework import serializers

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


# ── Feature ─────────────────────────────────────────────────────────────────

class FeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feature
        fields = ("id", "code", "name", "category", "description", "is_active", "sort_order")
        read_only_fields = ("id",)


class FeatureDependencySerializer(serializers.ModelSerializer):
    depends_on_code = serializers.CharField(source="depends_on.code", read_only=True)
    depends_on_name = serializers.CharField(source="depends_on.name", read_only=True)

    class Meta:
        model = FeatureDependency
        fields = ("id", "depends_on", "depends_on_code", "depends_on_name")
        read_only_fields = ("id",)


# ── Plan ─────────────────────────────────────────────────────────────────────

class PlanFeatureSerializer(serializers.ModelSerializer):
    feature_code = serializers.CharField(source="feature.code", read_only=True)
    feature_name = serializers.CharField(source="feature.name", read_only=True)

    class Meta:
        model = PlanFeature
        fields = ("id", "feature", "feature_code", "feature_name",
                  "can_view", "can_create", "can_edit", "can_delete")
        read_only_fields = ("id",)


class PlanListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ("id", "code", "name", "price_amount", "currency_code",
                  "is_free", "is_default", "is_active", "sort_order")
        read_only_fields = ("id",)


class PlanDetailSerializer(serializers.ModelSerializer):
    features = PlanFeatureSerializer(source="plan_features", many=True, read_only=True)

    class Meta:
        model = Plan
        fields = ("id", "code", "name", "description", "billing_period",
                  "price_amount", "currency_code", "is_free", "is_default",
                  "is_active", "sort_order", "features")
        read_only_fields = ("id",)


class PlanWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ("code", "name", "description", "billing_period",
                  "price_amount", "currency_code", "is_free", "is_default",
                  "is_active", "sort_order")

    def validate_is_free(self, value):
        if value:
            qs = Plan.objects.filter(is_free=True, is_active=True)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Ya existe un plan gratuito activo.")
        return value

    def validate_is_default(self, value):
        if value:
            qs = Plan.objects.filter(is_default=True)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Ya existe un plan por defecto.")
        return value


# ── Plan Features write ───────────────────────────────────────────────────────

class PlanFeatureWriteItemSerializer(serializers.Serializer):
    feature_id = serializers.UUIDField()
    can_view = serializers.BooleanField(default=False)
    can_create = serializers.BooleanField(default=False)
    can_edit = serializers.BooleanField(default=False)
    can_delete = serializers.BooleanField(default=False)


class PlanFeaturesWriteSerializer(serializers.Serializer):
    features = PlanFeatureWriteItemSerializer(many=True, max_length=200)
    auto_expand_deps = serializers.BooleanField(default=False)

    def validate(self, data):
        from apps.billing.services.dependencies import expand_dependencies
        from apps.billing.services.dependencies import validate_dependencies

        feature_ids = [item["feature_id"] for item in data["features"] if item.get("can_view")]
        active_codes = set(
            Feature.objects.filter(pk__in=feature_ids, is_active=True).values_list("code", flat=True)
        )

        if data.get("auto_expand_deps"):
            active_codes = expand_dependencies(active_codes)
            expanded_features = Feature.objects.filter(code__in=active_codes, is_active=True)
            data["_expanded_features"] = {f.code: f for f in expanded_features}

        try:
            validate_dependencies(active_codes)
        except Exception as exc:
            raise serializers.ValidationError(str(exc)) from exc

        return data


# ── TrialConfig ───────────────────────────────────────────────────────────────

class TrialFeatureDefaultSerializer(serializers.ModelSerializer):
    feature_code = serializers.CharField(source="feature.code", read_only=True)
    feature_name = serializers.CharField(source="feature.name", read_only=True)

    class Meta:
        model = TrialFeatureDefault
        fields = ("id", "feature", "feature_code", "feature_name",
                  "can_view", "can_create", "can_edit", "can_delete")
        read_only_fields = ("id",)


class TrialConfigSerializer(serializers.ModelSerializer):
    trial_features = TrialFeatureDefaultSerializer(
        source="trial_feature_defaults", many=True, read_only=True
    )
    trial_plan_code = serializers.CharField(source="trial_plan.code", read_only=True)

    class Meta:
        model = TrialConfig
        fields = ("id", "is_enabled", "default_trial_days", "trial_plan",
                  "trial_plan_code", "trial_features")
        read_only_fields = ("id",)


# ── RestaurantSubscription ────────────────────────────────────────────────────

class RestaurantSubscriptionSerializer(serializers.ModelSerializer):
    plan_code = serializers.CharField(source="plan.code", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    restaurant_name = serializers.CharField(source="restaurant.display_name", read_only=True)

    class Meta:
        model = RestaurantSubscription
        fields = (
            "id", "restaurant", "restaurant_name", "plan", "plan_code", "plan_name",
            "status", "trial_start", "trial_end", "override_trial_days",
            "current_period_start", "current_period_end",
            "cancelled_at", "scheduled_downgrade_to", "auto_renew",
        )
        read_only_fields = ("id", "restaurant", "restaurant_name",
                            "trial_start", "trial_end", "cancelled_at")


class AdminSubscriptionPatchSerializer(serializers.Serializer):
    plan = serializers.UUIDField(required=False)
    override_trial_days = serializers.IntegerField(required=False, min_value=1, max_value=365)
    force_reset_trial = serializers.BooleanField(required=False, default=False)


# ── RestaurantFeatureOverride ─────────────────────────────────────────────────

class RestaurantFeatureOverrideSerializer(serializers.ModelSerializer):
    feature_code = serializers.CharField(source="feature.code", read_only=True)
    feature_name = serializers.CharField(source="feature.name", read_only=True)

    class Meta:
        model = RestaurantFeatureOverride
        fields = (
            "id", "restaurant", "feature", "feature_code", "feature_name",
            "can_view", "can_create", "can_edit", "can_delete",
            "source", "expires_at",
        )
        read_only_fields = ("id", "restaurant")


# ── PlanChangeRequest ─────────────────────────────────────────────────────────

class PlanChangeRequestSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source="restaurant.display_name", read_only=True)
    requested_plan_name = serializers.CharField(source="requested_plan.name", read_only=True)
    current_plan_name = serializers.CharField(source="current_plan.name", read_only=True)
    requested_by_name = serializers.CharField(source="requested_by.name", read_only=True, default="")
    decided_by_name = serializers.CharField(source="decided_by.name", read_only=True, default="")

    class Meta:
        model = PlanChangeRequest
        fields = (
            "id", "restaurant", "restaurant_name",
            "requested_plan", "requested_plan_name",
            "current_plan", "current_plan_name",
            "request_type", "status", "notes",
            "requested_by", "requested_by_name",
            "decided_by", "decided_by_name", "decided_at",
            "created_at",
        )
        read_only_fields = (
            "id", "restaurant", "request_type", "status",
            "requested_by", "decided_by", "decided_at", "created_at",
        )


class DecisionSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


# ── SubscriptionEvent ─────────────────────────────────────────────────────────

class SubscriptionEventSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(source="restaurant.display_name", read_only=True)
    old_plan_name = serializers.CharField(source="old_plan.name", read_only=True, default="")
    new_plan_name = serializers.CharField(source="new_plan.name", read_only=True, default="")
    actor_name = serializers.CharField(source="actor.name", read_only=True, default="")

    class Meta:
        model = SubscriptionEvent
        fields = (
            "id", "restaurant", "restaurant_name",
            "event_type", "old_plan", "old_plan_name",
            "new_plan", "new_plan_name",
            "actor", "actor_name", "payload", "created_at",
        )
        read_only_fields = fields


# ── Owner-facing ─────────────────────────────────────────────────────────────

class OwnerSubscriptionSerializer(serializers.ModelSerializer):
    plan_code = serializers.CharField(source="plan.code", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    plan_price = serializers.DecimalField(
        source="plan.price_amount", max_digits=12, decimal_places=2, read_only=True
    )
    days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantSubscription
        fields = (
            "id", "plan", "plan_code", "plan_name", "plan_price",
            "status", "trial_end", "current_period_end", "cancelled_at",
            "days_remaining",
        )
        read_only_fields = fields

    def get_days_remaining(self, obj):
        from django.utils import timezone
        if obj.status == RestaurantSubscription.STATUS_TRIAL and obj.trial_end:
            delta = obj.trial_end - timezone.now()
            return max(0, delta.days)
        if obj.current_period_end:
            delta = obj.current_period_end - timezone.now()
            return max(0, delta.days)
        return None


class OwnerCreateChangeRequestSerializer(serializers.Serializer):
    requested_plan = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")
