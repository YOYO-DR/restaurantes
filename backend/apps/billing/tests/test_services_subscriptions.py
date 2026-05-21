from datetime import timedelta

import pytest
from django.utils import timezone

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Plan
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.models import TrialConfig
from apps.billing.services.subscriptions import activate_subscription
from apps.billing.services.subscriptions import cancel_subscription
from apps.billing.services.subscriptions import downgrade_to_free
from apps.billing.services.subscriptions import expire_trial
from apps.billing.services.subscriptions import get_active_subscription
from apps.billing.services.subscriptions import start_trial
from apps.billing.tests.factories import FeatureFactory
from apps.billing.tests.factories import FreePlanFactory
from apps.billing.tests.factories import PlanFactory
from apps.billing.tests.factories import RestaurantSubscriptionFactory
from apps.billing.tests.factories import TrialConfigFactory
from apps.billing.tests.factories import TrialFeatureDefaultFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


@pytest.mark.django_db
class TestStartTrial:
    def _setup_trial_config(self, days=14):
        ensure_billing_catalogs()
        config = TrialConfig.objects.first()
        config.is_enabled = True
        config.default_trial_days = days
        config.save()
        return config

    def test_creates_subscription_with_dates(self):
        self._setup_trial_config(30)
        restaurant = RestaurantFactory()
        sub = start_trial(restaurant)

        assert sub is not None
        assert sub.status == RestaurantSubscription.STATUS_TRIAL
        assert sub.trial_start is not None
        assert sub.trial_end is not None
        delta = sub.trial_end - sub.trial_start
        assert abs(delta.days - 30) <= 1

    def test_applies_trial_feature_defaults_as_overrides(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)

        overrides = RestaurantFeatureOverride.objects.filter(
            restaurant=restaurant,
            source=RestaurantFeatureOverride.SOURCE_TRIAL,
        )
        assert overrides.count() == 11  # all features

    def test_disabled_globally_creates_free_subscription(self):
        ensure_billing_catalogs()
        config = TrialConfig.objects.first()
        config.is_enabled = False
        config.save()

        restaurant = RestaurantFactory()
        sub = start_trial(restaurant)
        assert sub.plan.is_free is True
        assert sub.status == RestaurantSubscription.STATUS_ACTIVE

    def test_idempotent_second_call(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        sub1 = start_trial(restaurant)
        sub2 = start_trial(restaurant)
        assert sub1.pk == sub2.pk


@pytest.mark.django_db
class TestActivateSubscription:
    def test_changes_plan_and_period(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-test", name="Pro Test")

        sub = activate_subscription(restaurant, pro)
        assert sub.plan.pk == pro.pk
        assert sub.status == RestaurantSubscription.STATUS_ACTIVE
        assert sub.current_period_start is not None

    def test_clears_cancelled_at(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        sub = get_active_subscription(restaurant)
        sub.cancelled_at = timezone.now()
        sub.save()

        pro = PlanFactory(code="pro-act", name="Pro Act")
        sub = activate_subscription(restaurant, pro)
        assert sub.cancelled_at is None


@pytest.mark.django_db
class TestCancelSubscription:
    def test_marks_cancelled_at(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)

        sub = cancel_subscription(restaurant)
        assert sub.cancelled_at is not None
        assert sub.auto_renew is False

    def test_schedules_downgrade_to_free(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)

        sub = cancel_subscription(restaurant)
        assert sub.scheduled_downgrade_to is not None
        assert sub.scheduled_downgrade_to.is_free is True

    def test_status_remains_active_until_period_end(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-cancel", name="Pro Cancel")
        activate_subscription(restaurant, pro)

        sub = cancel_subscription(restaurant)
        assert sub.status == RestaurantSubscription.STATUS_ACTIVE

    def test_raises_if_already_cancelled(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        cancel_subscription(restaurant)

        with pytest.raises(ValueError, match="ya está cancelada"):
            cancel_subscription(restaurant)


@pytest.mark.django_db
class TestExpireTrial:
    def test_downgrades_to_free(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        sub = get_active_subscription(restaurant)
        sub.trial_end = timezone.now() - timedelta(hours=1)
        sub.save()

        expire_trial(restaurant)
        sub.refresh_from_db()
        assert sub.plan.is_free is True
        assert sub.status == RestaurantSubscription.STATUS_ACTIVE

    def test_removes_trial_source_overrides(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        sub = get_active_subscription(restaurant)
        sub.trial_end = timezone.now() - timedelta(hours=1)
        sub.save()

        expire_trial(restaurant)
        assert not RestaurantFeatureOverride.objects.filter(
            restaurant=restaurant,
            source=RestaurantFeatureOverride.SOURCE_TRIAL,
        ).exists()

    def test_noop_when_not_trial(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        free = Plan.objects.get(code="free")
        start_trial(restaurant)
        sub = get_active_subscription(restaurant)
        sub.plan = free
        sub.status = RestaurantSubscription.STATUS_ACTIVE
        sub.save()

        result = expire_trial(restaurant)
        assert result is None


@pytest.mark.django_db
class TestDowngradeToFree:
    def test_idempotent(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        downgrade_to_free(restaurant)
        downgrade_to_free(restaurant)
        sub = get_active_subscription(restaurant)
        assert sub.plan.is_free is True


@pytest.mark.django_db
class TestGetActiveSubscription:
    def test_returns_current(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        sub = get_active_subscription(restaurant)
        assert sub is not None
        assert sub.restaurant == restaurant

    def test_none_when_not_exists(self):
        restaurant = RestaurantFactory()
        sub = get_active_subscription(restaurant)
        assert sub is None
