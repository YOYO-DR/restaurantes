import pytest

from apps.loyalty.models import LoyaltyTier
from apps.loyalty.services import get_tier_for
from apps.restaurants.tests.factories import RestaurantFactory


pytestmark = pytest.mark.django_db


def test_get_tier_for_prefers_restaurant_tiers():
    restaurant = RestaurantFactory()
    LoyaltyTier.objects.create(code="base", name="Base global", min_points=0, restaurant=None)
    LoyaltyTier.objects.create(code="gold", name="Oro global", min_points=1000, restaurant=None)
    LoyaltyTier.objects.create(code="base", name="Base local", min_points=0, restaurant=restaurant)
    LoyaltyTier.objects.create(code="vip", name="VIP local", min_points=500, restaurant=restaurant)

    tier = get_tier_for(restaurant, 700)

    assert tier.name == "VIP local"
    assert tier.restaurant_id == restaurant.id


def test_get_tier_for_falls_back_to_global_when_no_restaurant_tier():
    restaurant = RestaurantFactory()
    LoyaltyTier.objects.create(code="base", name="Base global", min_points=0, restaurant=None)
    LoyaltyTier.objects.create(code="plata", name="Plata global", min_points=300, restaurant=None)

    tier = get_tier_for(restaurant, 350)

    assert tier.name == "Plata global"
    assert tier.restaurant_id is None
