import pytest
from rest_framework.test import APIRequestFactory

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Plan
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.permissions import PlanFeaturePermission
from apps.billing.permissions import plan_can
from apps.billing.tests.factories import FeatureFactory
from apps.billing.tests.factories import PlanFactory
from apps.billing.tests.factories import PlanFeatureFactory
from apps.billing.tests.factories import RestaurantFeatureOverrideFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


def _assign_role(user, role_code: str):
    from apps.accounts.models import Role
    from apps.accounts.models import UserRole
    role, _ = Role.objects.get_or_create(code=role_code, defaults={"name": role_code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def _set_plan_for_restaurant(restaurant, plan):
    RestaurantSubscription.objects.update_or_create(
        restaurant=restaurant,
        defaults={"plan": plan, "status": "active"},
    )
    RestaurantFeatureOverride.objects.filter(restaurant=restaurant).delete()


@pytest.mark.django_db
class TestPlanFeaturePermission:
    factory = APIRequestFactory()

    def _make_request(self, method, user):
        req = getattr(self.factory, method.lower())("/")
        req.user = user
        return req

    def test_view_blocked_without_can_view(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        plan = PlanFactory()
        feature = FeatureFactory(code="perm-feat1", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=False)
        _set_plan_for_restaurant(restaurant, plan)

        perm = type("TestPerm", (PlanFeaturePermission,), {"feature": "perm-feat1"})()
        req = self._make_request("GET", user)
        assert not perm.has_permission(req, None)

    def test_post_blocked_without_can_create(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        plan = PlanFactory()
        feature = FeatureFactory(code="perm-feat2", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True, can_create=False)
        _set_plan_for_restaurant(restaurant, plan)

        perm = type("TestPerm2", (PlanFeaturePermission,), {"feature": "perm-feat2"})()
        req = self._make_request("POST", user)
        assert not perm.has_permission(req, None)

    def test_put_blocked_without_can_edit(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        plan = PlanFactory()
        feature = FeatureFactory(code="perm-feat3", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True, can_edit=False)
        _set_plan_for_restaurant(restaurant, plan)

        perm = type("TestPerm3", (PlanFeaturePermission,), {"feature": "perm-feat3"})()
        req = self._make_request("PUT", user)
        assert not perm.has_permission(req, None)

    def test_delete_blocked_without_can_delete(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        plan = PlanFactory()
        feature = FeatureFactory(code="perm-feat4", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True, can_delete=False)
        _set_plan_for_restaurant(restaurant, plan)

        perm = type("TestPerm4", (PlanFeaturePermission,), {"feature": "perm-feat4"})()
        req = self._make_request("DELETE", user)
        assert not perm.has_permission(req, None)

    def test_override_supersedes_plan(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        plan = PlanFactory()
        feature = FeatureFactory(code="perm-feat5", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=False)
        _set_plan_for_restaurant(restaurant, plan)
        RestaurantFeatureOverrideFactory(restaurant=restaurant, feature=feature, can_view=True)

        result = plan_can(user, "perm-feat5", "view")
        assert result is True

    def test_admin_bypasses_plan_check(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "admin")

        perm = type("TestPerm5", (PlanFeaturePermission,), {"feature": "menu"})()
        req = self._make_request("DELETE", user)
        assert perm.has_permission(req, None)

    def test_owner_without_subscription_returns_false(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        RestaurantSubscription.objects.filter(restaurant=restaurant).delete()

        result = plan_can(user, "menu", "view")
        assert result is False
