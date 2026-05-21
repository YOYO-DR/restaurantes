from datetime import timedelta

import pytest
from django.utils import timezone

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Plan
from apps.billing.models import RestaurantSubscription
from apps.billing.models import SubscriptionEvent
from apps.billing.services.subscriptions import activate_subscription
from apps.billing.services.subscriptions import cancel_subscription
from apps.billing.services.subscriptions import start_trial
from apps.billing.tasks import expire_trials_task
from apps.billing.tasks import process_scheduled_downgrades_task
from apps.billing.tests.factories import PlanFactory
from apps.billing.tests.factories import RestaurantSubscriptionFactory
from apps.restaurants.tests.factories import RestaurantFactory


@pytest.mark.django_db
class TestExpireTrialsTask:
    def test_only_processes_expired(self):
        ensure_billing_catalogs()
        r1 = RestaurantFactory()
        r2 = RestaurantFactory()
        start_trial(r1)
        start_trial(r2)

        # Expire r1
        sub1 = RestaurantSubscription.objects.get(restaurant=r1)
        sub1.trial_end = timezone.now() - timedelta(hours=2)
        sub1.save()

        result = expire_trials_task()
        assert result["expired"] == 1

        sub1.refresh_from_db()
        sub2 = RestaurantSubscription.objects.get(restaurant=r2)
        assert sub1.plan.is_free is True
        assert sub2.status == RestaurantSubscription.STATUS_TRIAL

    def test_idempotent_double_run(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        sub = RestaurantSubscription.objects.get(restaurant=restaurant)
        sub.trial_end = timezone.now() - timedelta(hours=2)
        sub.save()

        expire_trials_task()
        result = expire_trials_task()
        assert result["expired"] == 0

    def test_creates_audit_events(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        sub = RestaurantSubscription.objects.get(restaurant=restaurant)
        sub.trial_end = timezone.now() - timedelta(hours=2)
        sub.save()

        initial_count = SubscriptionEvent.objects.filter(restaurant=restaurant).count()
        expire_trials_task()
        assert SubscriptionEvent.objects.filter(restaurant=restaurant).count() > initial_count


@pytest.mark.django_db
class TestProcessScheduledDowngradesTask:
    def test_only_past_period_end(self):
        ensure_billing_catalogs()
        r1 = RestaurantFactory()
        r2 = RestaurantFactory()
        pro = PlanFactory(code="pro-tasks", name="Pro Tasks", price_amount="50000.00")

        # r1: cancel con period_end pasado → debe downgrade
        start_trial(r1)
        activate_subscription(r1, pro)
        cancel_subscription(r1)
        sub1 = RestaurantSubscription.objects.get(restaurant=r1)
        sub1.current_period_end = timezone.now() - timedelta(days=1)
        sub1.save()

        # r2: cancel pero period_end futuro → NO debe downgrade
        start_trial(r2)
        activate_subscription(r2, pro)
        cancel_subscription(r2)
        sub2 = RestaurantSubscription.objects.get(restaurant=r2)
        sub2.current_period_end = timezone.now() + timedelta(days=10)
        sub2.save()

        result = process_scheduled_downgrades_task()
        assert result["downgraded"] == 1

        sub1.refresh_from_db()
        sub2.refresh_from_db()
        assert sub1.plan.is_free is True
        assert sub2.plan.pk == pro.pk

    def test_idempotent(self):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        pro = PlanFactory(code="pro-idem", name="Pro Idem", price_amount="50000.00")
        start_trial(restaurant)
        activate_subscription(restaurant, pro)
        cancel_subscription(restaurant)
        sub = RestaurantSubscription.objects.get(restaurant=restaurant)
        sub.current_period_end = timezone.now() - timedelta(days=1)
        sub.save()

        process_scheduled_downgrades_task()
        result = process_scheduled_downgrades_task()
        assert result["downgraded"] == 0
