import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db import transaction

from apps.billing.models import FeatureDependency
from apps.billing.models import Plan
from apps.billing.models import PlanFeature
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.models import TrialConfig
from apps.billing.tests.factories import FeatureDependencyFactory
from apps.billing.tests.factories import FeatureFactory
from apps.billing.tests.factories import FreePlanFactory
from apps.billing.tests.factories import PlanChangeRequestFactory
from apps.billing.tests.factories import PlanFactory
from apps.billing.tests.factories import PlanFeatureFactory
from apps.billing.tests.factories import RestaurantFeatureOverrideFactory
from apps.billing.tests.factories import RestaurantSubscriptionFactory
from apps.billing.tests.factories import TrialConfigFactory
from apps.restaurants.tests.factories import RestaurantFactory


@pytest.mark.django_db
class TestFeatureModel:
    def test_feature_code_unique(self):
        from apps.billing.models import Feature

        Feature.objects.create(code="uniq-menu", name="Menu")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Feature.objects.create(code="uniq-menu", name="Menu Dupe")

    def test_feature_str(self):
        f = FeatureFactory(name="Menú Digital")
        assert str(f) == "Menú Digital"


@pytest.mark.django_db
class TestFeatureDependencyModel:
    def test_feature_dependency_no_self_loop_via_db(self):
        f = FeatureFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                FeatureDependency.objects.create(feature=f, depends_on=f)

    def test_feature_dependency_no_self_loop_via_clean(self):
        f = FeatureFactory()
        dep = FeatureDependency(feature=f, depends_on=f)
        with pytest.raises(ValidationError):
            dep.clean()

    def test_feature_dependency_unique_pair(self):
        f1 = FeatureFactory()
        f2 = FeatureFactory()
        FeatureDependencyFactory(feature=f1, depends_on=f2)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                FeatureDependency.objects.create(feature=f1, depends_on=f2)

    def test_feature_dependency_str(self):
        f1 = FeatureFactory(name="Lealtad")
        f2 = FeatureFactory(name="Clientes")
        dep = FeatureDependencyFactory(feature=f1, depends_on=f2)
        assert "Lealtad" in str(dep)
        assert "Clientes" in str(dep)


@pytest.mark.django_db
class TestPlanModel:
    def test_plan_is_free_unique_among_active(self):
        FreePlanFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Plan.objects.create(code="free2", name="Free 2", is_free=True, is_active=True)

    def test_plan_is_default_unique(self):
        Plan.objects.filter(is_default=True).update(is_default=False)
        PlanFactory(is_default=True)
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Plan.objects.create(code="default2", name="Default 2", is_default=True)

    def test_plan_str(self):
        plan = PlanFactory(name="Pro")
        assert str(plan) == "Pro"

    def test_plan_metadata_default_empty_dict(self):
        plan = PlanFactory()
        assert plan.metadata == {}


@pytest.mark.django_db
class TestPlanFeatureModel:
    def test_plan_feature_unique_pair(self):
        pf = PlanFeatureFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                PlanFeature.objects.create(
                    plan=pf.plan,
                    feature=pf.feature,
                    can_view=False,
                )

    def test_plan_feature_str(self):
        pf = PlanFeatureFactory()
        assert str(pf.plan) in str(pf)
        assert str(pf.feature) in str(pf)


@pytest.mark.django_db
class TestTrialConfigModel:
    def test_trial_config_singleton_enforced(self):
        # Ensure at least one TrialConfig exists (seed may have already created it)
        if not TrialConfig.objects.exists():
            TrialConfigFactory()
        second = TrialConfig(is_enabled=True, default_trial_days=7)
        with pytest.raises(ValidationError):
            second.save()

    def test_trial_config_str(self):
        tc = TrialConfig.objects.first()
        if tc is None:
            tc = TrialConfigFactory(default_trial_days=14)
        assert str(tc.default_trial_days) in str(tc)


@pytest.mark.django_db
class TestRestaurantSubscriptionModel:
    def test_restaurant_subscription_one_to_one(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        RestaurantSubscription.objects.create(restaurant=restaurant, plan=plan, status="active")
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RestaurantSubscription.objects.create(restaurant=restaurant, plan=plan, status="trial")

    def test_subscription_status_choices_valid(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        sub = RestaurantSubscription.objects.create(restaurant=restaurant, plan=plan, status="trial")
        assert sub.status == "trial"
        sub.status = RestaurantSubscription.STATUS_ACTIVE
        sub.save()
        sub.refresh_from_db()
        assert sub.status == "active"

    def test_subscription_str(self):
        sub = RestaurantSubscriptionFactory()
        assert str(sub.restaurant) in str(sub)
        assert str(sub.plan) in str(sub)


@pytest.mark.django_db
class TestRestaurantFeatureOverrideModel:
    def test_restaurant_feature_override_unique_pair(self):
        override = RestaurantFeatureOverrideFactory()
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                RestaurantFeatureOverride.objects.create(
                    restaurant=override.restaurant,
                    feature=override.feature,
                    source="admin",
                )

    def test_override_str(self):
        override = RestaurantFeatureOverrideFactory()
        s = str(override)
        assert "Override" in s


@pytest.mark.django_db
class TestPlanChangeRequestModel:
    def test_plan_change_request_str(self):
        req = PlanChangeRequestFactory()
        s = str(req)
        assert "Request" in s
        assert str(req.requested_plan) in s

    def test_plan_change_request_status_default_pending(self):
        req = PlanChangeRequestFactory()
        assert req.status == "pending"
