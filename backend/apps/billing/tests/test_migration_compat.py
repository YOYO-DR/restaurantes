import pytest

from apps.billing.models import Plan
from apps.restaurants.models import Restaurant
from apps.restaurants.tests.factories import RestaurantFactory


@pytest.mark.django_db
class TestMigrationCompat:
    def test_restaurants_have_billing_plan_fk(self):
        """After migration, Restaurant.subscription_plan must point to billing.Plan."""
        from apps.billing.tests.factories import PlanFactory
        plan = PlanFactory()
        restaurant = RestaurantFactory(subscription_plan=plan)
        restaurant.refresh_from_db()
        assert isinstance(restaurant.subscription_plan, Plan)
        assert restaurant.subscription_plan_id == plan.pk

    def test_plan_related_name_restaurants(self):
        from apps.billing.tests.factories import PlanFactory
        plan = PlanFactory()
        r1 = RestaurantFactory(subscription_plan=plan)
        r2 = RestaurantFactory(subscription_plan=plan)
        assert plan.restaurants.count() == 2

    def test_restaurant_without_subscription_gets_backfilled_plan(self):
        """RestaurantFactory must always produce a valid billing.Plan."""
        r = RestaurantFactory()
        assert r.subscription_plan_id is not None
        assert Plan.objects.filter(pk=r.subscription_plan_id).exists()
