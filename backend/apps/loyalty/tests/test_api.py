import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Favorite
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def test_customer_loyalty_requires_authentication(api_client: APIClient):
    response = api_client.get(reverse("api:customer-loyalty-list"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_customer_loyalty_returns_authenticated_user_data(api_client: APIClient):
    user = UserFactory()
    other_user = UserFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0)
    restaurant = RestaurantFactory(display_name="La Brasa")
    other_restaurant = RestaurantFactory(display_name="Otra Cocina")

    LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=120,
        lifetime_points=300,
    )
    LoyaltyAccount.objects.create(
        user=other_user,
        restaurant=other_restaurant,
        tier=tier,
        current_points=900,
        lifetime_points=1200,
    )
    favorite_restaurant = restaurant
    Favorite.objects.create(user=user, restaurant=favorite_restaurant)
    LoyaltyReward.objects.create(
        restaurant=favorite_restaurant,
        name="Postre gratis",
        description="Brownie",
        points_cost=80,
        is_active=True,
    )
    LoyaltyReward.objects.create(
        restaurant=RestaurantFactory(display_name="Otra Cocina"),
        name="Bebida gratis",
        description="Limonada",
        points_cost=60,
        is_active=True,
    )
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api:customer-loyalty-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["current_points"] == 120
    assert response.data["total_earned"] == 300
    assert response.data["current_level"] == "Varios"
    assert [reward["name"] for reward in response.data["available_rewards"]] == [
        "Postre gratis",
    ]
