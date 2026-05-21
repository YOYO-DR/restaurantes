import pytest
from rest_framework.test import APIClient

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Feature
from apps.billing.models import Plan
from apps.billing.models import PlanChangeRequest
from apps.billing.models import PlanFeature
from apps.billing.models import RestaurantSubscription
from apps.billing.models import TrialConfig
from apps.billing.services.subscriptions import start_trial
from apps.billing.tests.factories import FeatureFactory
from apps.billing.tests.factories import PlanFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


def _assign_role(user, code):
    from apps.accounts.models import Role, UserRole
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def _admin_client():
    user = UserFactory()
    _assign_role(user, "admin")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def _owner_client():
    user = UserFactory()
    _assign_role(user, "restaurante")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
class TestAdminFeaturesAPI:
    def test_list_requires_admin(self):
        owner_client, _ = _owner_client()
        resp = owner_client.get("/api/admin/billing/features/")
        assert resp.status_code == 403

    def test_crud_features(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()

        resp = client.get("/api/admin/billing/features/")
        assert resp.status_code == 200
        assert len(resp.data) == 11

        resp = client.post("/api/admin/billing/features/", {
            "code": "test-feat", "name": "Test Feature", "is_active": True, "sort_order": 99
        }, format="json")
        assert resp.status_code == 201
        feat_id = resp.data["id"]

        resp = client.patch(f"/api/admin/billing/features/{feat_id}/", {"name": "Updated"}, format="json")
        assert resp.status_code == 200
        assert resp.data["name"] == "Updated"

        resp = client.delete(f"/api/admin/billing/features/{feat_id}/")
        assert resp.status_code == 204

    def test_set_dependencies(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        lealtad = Feature.objects.get(code="lealtad")
        clientes = Feature.objects.get(code="clientes")

        resp = client.post(
            f"/api/admin/billing/features/{lealtad.pk}/dependencies/",
            [str(clientes.pk)],
            format="json",
        )
        assert resp.status_code == 200

    def test_dependency_cycle_returns_400(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        clientes = Feature.objects.get(code="clientes")
        lealtad = Feature.objects.get(code="lealtad")

        resp = client.post(
            f"/api/admin/billing/features/{clientes.pk}/dependencies/",
            [str(lealtad.pk)],
            format="json",
        )
        assert resp.status_code == 400


@pytest.mark.django_db
class TestAdminPlansAPI:
    def test_list_plans(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        resp = client.get("/api/admin/billing/plans/")
        assert resp.status_code == 200
        assert len(resp.data) >= 2

    def test_create_plan_with_features(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()

        menu = Feature.objects.get(code="menu")
        resp = client.post("/api/admin/billing/plans/", {
            "code": "pro-api", "name": "Pro API", "price_amount": "50000",
            "currency_code": "COP", "is_active": True, "sort_order": 5
        }, format="json")
        assert resp.status_code == 201
        plan_id = resp.data["id"]

        resp = client.post(f"/api/admin/billing/plans/{plan_id}/features/", {
            "features": [{"feature_id": str(menu.pk), "can_view": True, "can_create": True}],
            "auto_expand_deps": False,
        }, format="json")
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_update_features_validates_dependencies(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        plan = PlanFactory(code="dep-test-plan", name="Dep Test")
        lealtad = Feature.objects.get(code="lealtad")

        resp = client.post(f"/api/admin/billing/plans/{plan.pk}/features/", {
            "features": [{"feature_id": str(lealtad.pk), "can_view": True}],
            "auto_expand_deps": False,
        }, format="json")
        assert resp.status_code == 400

    def test_delete_blocked_when_restaurants_assigned(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        plan = Plan.objects.get(code="free")
        restaurant = RestaurantFactory(subscription_plan=plan)
        RestaurantSubscription.objects.update_or_create(
            restaurant=restaurant, defaults={"plan": plan, "status": "active"}
        )

        resp = client.delete(f"/api/admin/billing/plans/{plan.pk}/")
        assert resp.status_code == 400


@pytest.mark.django_db
class TestAdminTrialConfigAPI:
    def test_get_returns_singleton(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        resp = client.get("/api/admin/billing/trial-config/")
        assert resp.status_code == 200
        assert "default_trial_days" in resp.data

    def test_patch_updates_default_days(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        config = TrialConfig.objects.first()
        resp = client.patch(f"/api/admin/billing/trial-config/{config.pk}/", {
            "default_trial_days": 30
        }, format="json")
        assert resp.status_code == 200
        assert resp.data["default_trial_days"] == 30

    def test_patch_replaces_trial_features(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        config = TrialConfig.objects.first()
        menu = Feature.objects.get(code="menu")
        resp = client.patch(f"/api/admin/billing/trial-config/{config.pk}/", {
            "trial_features": [{"feature": str(menu.pk), "can_view": True, "can_create": True}]
        }, format="json")
        assert resp.status_code == 200
        assert len(resp.data["trial_features"]) == 1


@pytest.mark.django_db
class TestAdminRestaurantSubscriptionAPI:
    def test_get_subscription(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        restaurant = RestaurantFactory()
        start_trial(restaurant)

        resp = client.get(f"/api/admin/billing/restaurant-subscriptions/{restaurant.pk}/")
        assert resp.status_code == 200
        assert "plan" in resp.data

    def test_get_subscription_creates_trial_when_missing(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        restaurant = RestaurantFactory()
        RestaurantSubscription.objects.filter(restaurant=restaurant).delete()

        resp = client.get(f"/api/admin/billing/restaurant-subscriptions/{restaurant.pk}/")

        assert resp.status_code == 200
        assert RestaurantSubscription.objects.filter(restaurant=restaurant).exists()

    def test_patch_changes_plan(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        restaurant = RestaurantFactory()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-admin-api", name="Pro Admin")

        resp = client.patch(
            f"/api/admin/billing/restaurant-subscriptions/{restaurant.pk}/",
            {"plan": str(pro.pk)},
            format="json",
        )
        assert resp.status_code == 200
        assert str(resp.data["plan"]) == str(pro.pk)

    def test_patch_extends_trial(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        restaurant = RestaurantFactory()
        start_trial(restaurant)

        resp = client.patch(
            f"/api/admin/billing/restaurant-subscriptions/{restaurant.pk}/",
            {"override_trial_days": 60},
            format="json",
        )
        assert resp.status_code == 200

    def test_set_feature_overrides(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        restaurant = RestaurantFactory()
        menu = Feature.objects.get(code="menu")

        resp = client.post(
            f"/api/admin/billing/restaurant-subscriptions/{restaurant.pk}/overrides/",
            {"feature": str(menu.pk), "can_view": True, "can_create": True, "can_edit": False, "can_delete": False},
            format="json",
        )
        assert resp.status_code == 201


@pytest.mark.django_db
class TestAdminPlanChangeRequestAPI:
    def test_list_with_filter(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        resp = client.get("/api/admin/billing/plan-change-requests/?status=pending")
        assert resp.status_code == 200

    def test_approve_creates_event(self):
        from apps.billing.services.requests import create_change_request

        ensure_billing_catalogs()
        admin_client, _ = _admin_client()
        owner = UserFactory()
        _assign_role(owner, "restaurante")
        restaurant = RestaurantFactory(owner=owner)
        start_trial(restaurant)
        pro = PlanFactory(code="pro-approve-api", name="Pro Approve API", price_amount="50000")
        req = create_change_request(restaurant, pro, owner)

        resp = admin_client.post(
            f"/api/admin/billing/plan-change-requests/{req.pk}/approve/",
            {"notes": "OK"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "approved"

    def test_reject_with_notes(self):
        from apps.billing.services.requests import create_change_request

        ensure_billing_catalogs()
        admin_client, _ = _admin_client()
        owner = UserFactory()
        _assign_role(owner, "restaurante")
        restaurant = RestaurantFactory(owner=owner)
        start_trial(restaurant)
        pro = PlanFactory(code="pro-reject-api", name="Pro Reject API", price_amount="50000")
        req = create_change_request(restaurant, pro, owner)

        resp = admin_client.post(
            f"/api/admin/billing/plan-change-requests/{req.pk}/reject/",
            {"notes": "No aplica"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "rejected"


@pytest.mark.django_db
class TestAdminSubscriptionEventsAPI:
    def test_list_filterable(self):
        ensure_billing_catalogs()
        client, _ = _admin_client()
        restaurant = RestaurantFactory()
        start_trial(restaurant)

        resp = client.get(f"/api/admin/billing/subscription-events/?restaurant={restaurant.pk}")
        assert resp.status_code == 200
