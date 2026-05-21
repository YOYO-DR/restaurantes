import pytest
from rest_framework.test import APIClient

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Plan
from apps.billing.models import PlanChangeRequest
from apps.billing.models import RestaurantSubscription
from apps.billing.services.subscriptions import activate_subscription
from apps.billing.services.subscriptions import start_trial
from apps.billing.tests.factories import PlanFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


def _assign_role(user, code):
    from apps.accounts.models import Role, UserRole
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def _owner_client_with_restaurant():
    user = UserFactory()
    _assign_role(user, "restaurante")
    restaurant = RestaurantFactory(owner=user)
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user, restaurant


def _operator_client():
    user = UserFactory()
    _assign_role(user, "operador")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
class TestOwnerSubscriptionAPI:
    def test_get_subscription_returns_plan_and_features(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        start_trial(restaurant)

        resp = client.get("/api/owner/billing/subscription/")
        assert resp.status_code == 200
        assert "plan" in resp.data
        assert "status" in resp.data

    def test_get_subscription_includes_trial_end_when_in_trial(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        start_trial(restaurant)

        resp = client.get("/api/owner/billing/subscription/")
        assert resp.status_code == 200
        assert resp.data["status"] == "trial"
        assert resp.data["trial_end"] is not None

    def test_cancel_subscription_schedules_downgrade(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        pro = PlanFactory(code="pro-cancel-owner", name="Pro Cancel Owner", price_amount="50000")
        start_trial(restaurant)
        activate_subscription(restaurant, pro)

        resp = client.post("/api/owner/billing/subscription/cancel/")
        assert resp.status_code == 200
        assert resp.data["cancelled_at"] is not None

    def test_cancel_already_cancelled_returns_400(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        pro = PlanFactory(code="pro-cancel2-owner", name="Pro Cancel2", price_amount="50000")
        start_trial(restaurant)
        activate_subscription(restaurant, pro)
        client.post("/api/owner/billing/subscription/cancel/")

        resp = client.post("/api/owner/billing/subscription/cancel/")
        assert resp.status_code == 400

    def test_operator_cannot_access_owner_billing(self):
        ensure_billing_catalogs()
        op_client, _ = _operator_client()
        resp = op_client.get("/api/owner/billing/subscription/")
        assert resp.status_code == 403

    def test_get_plans_list_only_active_non_free(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        PlanFactory(code="pro-list", name="Pro List", price_amount="50000", is_active=True)
        PlanFactory(code="inactive-plan", name="Inactive", is_active=False)

        resp = client.get("/api/owner/billing/plans/")
        assert resp.status_code == 200
        codes = [p["code"] for p in resp.data]
        assert "free" not in codes
        assert "inactive-plan" not in codes
        assert "pro-list" in codes


@pytest.mark.django_db
class TestOwnerPlanChangeRequestAPI:
    def test_create_pending_request(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-req-owner", name="Pro Req Owner", price_amount="50000", is_active=True)

        resp = client.post("/api/owner/billing/plan-change-requests/", {
            "requested_plan": str(pro.pk),
            "notes": "Quiero el pro",
        }, format="json")
        assert resp.status_code == 201
        assert resp.data["status"] == "pending"

    def test_conflict_when_pending_exists(self):
        ensure_billing_catalogs()
        client, user, restaurant = _owner_client_with_restaurant()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-dup-owner", name="Pro Dup Owner", price_amount="50000", is_active=True)
        client.post("/api/owner/billing/plan-change-requests/", {
            "requested_plan": str(pro.pk)
        }, format="json")

        resp = client.post("/api/owner/billing/plan-change-requests/", {
            "requested_plan": str(pro.pk)
        }, format="json")
        assert resp.status_code in (400, 409)
