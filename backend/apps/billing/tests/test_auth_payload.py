import pytest
from rest_framework.test import APIClient

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Plan
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.services.subscriptions import start_trial
from apps.billing.tests.factories import PlanFactory
from apps.billing.tests.factories import PlanFeatureFactory
from apps.billing.tests.factories import FeatureFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


def _assign_role(user, code):
    from apps.accounts.models import Role, UserRole
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def _auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestMeEndpointSubscription:
    def test_returns_subscription_for_owner(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        start_trial(restaurant)

        client = _auth_client(user)
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 200
        sub = resp.data.get("subscription")
        assert sub is not None
        assert sub["status"] == "trial"
        assert "features" in sub

    def test_returns_null_subscription_for_cliente(self):
        user = UserFactory()
        _assign_role(user, "cliente")
        client = _auth_client(user)
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 200
        assert resp.data.get("subscription") is None

    def test_returns_null_subscription_for_admin(self):
        user = UserFactory()
        _assign_role(user, "admin")
        client = _auth_client(user)
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 200
        assert resp.data.get("subscription") is None

    def test_features_reflect_plan_features(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        free = Plan.objects.get(code="free")
        RestaurantSubscription.objects.update_or_create(
            restaurant=restaurant,
            defaults={"plan": free, "status": "active"},
        )

        client = _auth_client(user)
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 200
        sub = resp.data.get("subscription")
        assert sub is not None
        # Free plan: all can_view=True, create/edit/delete=False
        assert sub["features"]["menu"]["can_view"] is True
        assert sub["features"]["menu"]["can_create"] is False

    def test_features_reflect_override_change(self):
        ensure_billing_catalogs()
        user = UserFactory()
        _assign_role(user, "restaurante")
        restaurant = RestaurantFactory(owner=user)
        free = Plan.objects.get(code="free")
        RestaurantSubscription.objects.update_or_create(
            restaurant=restaurant,
            defaults={"plan": free, "status": "active"},
        )
        menu = FeatureFactory(code="menu")
        RestaurantFeatureOverride.objects.update_or_create(
            restaurant=restaurant,
            feature=menu,
            defaults={"can_view": True, "can_create": True, "source": "admin"},
        )

        client = _auth_client(user)
        resp = client.get("/api/auth/me/")
        assert resp.status_code == 200
        assert resp.data["subscription"]["features"]["menu"]["can_create"] is True
