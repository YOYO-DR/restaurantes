import pytest

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Plan
from apps.billing.models import RestaurantSubscription
from apps.billing.services.features import check_feature_access
from apps.billing.services.features import get_effective_features
from apps.billing.services.features import serialize_features_for_jwt
from apps.billing.tests.factories import FeatureFactory
from apps.billing.tests.factories import PlanFactory
from apps.billing.tests.factories import PlanFeatureFactory
from apps.billing.tests.factories import RestaurantFeatureOverrideFactory
from apps.restaurants.tests.factories import RestaurantFactory


def _set_plan(restaurant, plan):
    """Helper: create or update subscription for restaurant and clear overrides."""
    from apps.billing.models import RestaurantFeatureOverride
    RestaurantSubscription.objects.update_or_create(
        restaurant=restaurant,
        defaults={"plan": plan, "status": RestaurantSubscription.STATUS_ACTIVE},
    )
    RestaurantFeatureOverride.objects.filter(restaurant=restaurant).delete()


@pytest.mark.django_db
class TestGetEffectiveFeatures:
    def test_returns_plan_features_when_no_overrides(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-eff1", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True, can_create=True)
        _set_plan(restaurant, plan)

        result = get_effective_features(restaurant.pk)
        assert "feat-eff1" in result
        assert result["feat-eff1"]["can_view"] is True
        assert result["feat-eff1"]["can_create"] is True

    def test_override_supersedes_plan(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-eff2", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=False, can_create=False)
        _set_plan(restaurant, plan)
        RestaurantFeatureOverrideFactory(restaurant=restaurant, feature=feature, can_view=True, can_create=True)

        result = get_effective_features(restaurant.pk)
        assert result["feat-eff2"]["can_view"] is True
        assert result["feat-eff2"]["can_create"] is True

    def test_inactive_feature_excluded(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-inactive", is_active=False)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True)
        _set_plan(restaurant, plan)

        result = get_effective_features(restaurant.pk)
        assert "feat-inactive" not in result

    def test_without_subscription_returns_empty(self):
        restaurant = RestaurantFactory()
        # No subscription created (on_commit in signal doesn't fire in tests)
        result = get_effective_features(restaurant.pk)
        assert result == {}


@pytest.mark.django_db
class TestCheckFeatureAccess:
    def test_view_only(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-view1", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True)
        _set_plan(restaurant, plan)

        assert check_feature_access(restaurant.pk, "feat-view1", "view") is True

    def test_create_requires_can_view(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-create1", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=False, can_create=True)
        _set_plan(restaurant, plan)

        assert check_feature_access(restaurant.pk, "feat-create1", "create") is False

    def test_create_with_view_allowed(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-create2", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True, can_create=True)
        _set_plan(restaurant, plan)

        assert check_feature_access(restaurant.pk, "feat-create2", "create") is True

    def test_missing_feature_returns_false(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        _set_plan(restaurant, plan)
        assert check_feature_access(restaurant.pk, "nonexistent", "view") is False

    @pytest.mark.parametrize("feature_code", [
        "menu", "pedidos", "inventario", "clientes", "lealtad",
        "resenas", "analiticas", "qr", "personalizacion", "configuracion", "operadores",
    ])
    @pytest.mark.parametrize("action", ["view", "create", "edit", "delete"])
    def test_matrix_all_modules_all_actions(self, feature_code, action):
        ensure_billing_catalogs()
        restaurant = RestaurantFactory()
        free = Plan.objects.get(code="free")
        _set_plan(restaurant, free)
        result = check_feature_access(restaurant.pk, feature_code, action)
        if action == "view":
            assert result is True
        else:
            assert result is False


@pytest.mark.django_db
class TestSerializeFeaturesForJwt:
    def test_shape(self):
        restaurant = RestaurantFactory()
        plan = PlanFactory()
        feature = FeatureFactory(code="feat-jwt", is_active=True)
        PlanFeatureFactory(plan=plan, feature=feature, can_view=True)
        _set_plan(restaurant, plan)

        result = serialize_features_for_jwt(restaurant.pk)
        assert "feat-jwt" in result
        assert set(result["feat-jwt"].keys()) == {"can_view", "can_create", "can_edit", "can_delete"}
