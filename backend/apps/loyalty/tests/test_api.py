import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Favorite
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyRedemptionStatus
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import LoyaltyTransactionType
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
    assert response.data["current_level"] == "Base"
    assert response.data["points_by_restaurant"] == [
        {
            "restaurant_id": str(restaurant.id),
            "restaurant_name": "La Brasa",
            "current_points": 120,
            "total_earned": 300,
            "current_level": "Base",
        },
    ]
    assert [reward["name"] for reward in response.data["available_rewards"]] == [
        "Postre gratis",
    ]


def test_customer_loyalty_filters_rewards_by_current_points(api_client: APIClient):
    user = UserFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0)
    restaurant = RestaurantFactory(display_name="La Brasa")
    Favorite.objects.create(user=user, restaurant=restaurant)
    LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=90,
        lifetime_points=130,
    )
    LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Postre gratis",
        description="Brownie",
        points_cost=80,
        is_active=True,
    )
    LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Combo premium",
        description="Especial",
        points_cost=120,
        is_active=True,
    )
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api:customer-loyalty-list"))

    assert response.status_code == status.HTTP_200_OK
    assert [reward["name"] for reward in response.data["available_rewards"]] == [
        "Postre gratis",
    ]


def test_customer_loyalty_filters_by_restaurant_and_returns_single_level(api_client: APIClient):
    user = UserFactory()
    tier_base = LoyaltyTier.objects.create(code="base", name="Base", min_points=0)
    tier_vip = LoyaltyTier.objects.create(code="vip", name="VIP", min_points=500)
    first_restaurant = RestaurantFactory(display_name="Norte")
    second_restaurant = RestaurantFactory(display_name="Sur")

    LoyaltyAccount.objects.create(
        user=user,
        restaurant=first_restaurant,
        tier=tier_base,
        current_points=120,
        lifetime_points=320,
    )
    LoyaltyAccount.objects.create(
        user=user,
        restaurant=second_restaurant,
        tier=tier_vip,
        current_points=700,
        lifetime_points=900,
    )
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse("api:customer-loyalty-list"),
        {"restaurant_id": str(second_restaurant.id)},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["current_points"] == 700
    assert response.data["total_earned"] == 900
    assert response.data["current_level"] == "VIP"
    assert response.data["points_by_restaurant"] == [
        {
            "restaurant_id": str(second_restaurant.id),
            "restaurant_name": "Sur",
            "current_points": 700,
            "total_earned": 900,
            "current_level": "VIP",
        },
    ]


def test_customer_can_cancel_pending_redemption_and_recovers_points(api_client: APIClient):
    user = UserFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0)
    restaurant = RestaurantFactory(display_name="La Brasa")
    account = LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=20,
        lifetime_points=100,
    )
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Postre",
        description="Brownie",
        points_cost=80,
        is_active=True,
        available_quantity=0,
    )
    tx_type, _ = LoyaltyTransactionType.objects.get_or_create(
        code="reward_redeemed",
        defaults={"name": "Recompensa canjeada"},
    )
    pending_status, _ = LoyaltyRedemptionStatus.objects.get_or_create(
        code="pending",
        defaults={"name": "Pendiente"},
    )
    tx = LoyaltyTransaction.objects.create(
        loyalty_account=account,
        tx_type=tx_type,
        points_delta=-80,
        description="Canje de recompensa: Postre",
    )
    redemption = LoyaltyRedemption.objects.create(
        loyalty_transaction=tx,
        loyalty_reward=reward,
        status=pending_status,
        points_applied=0,
    )

    api_client.force_authenticate(user=user)
    response = api_client.delete(
        reverse("api:customer-loyalty-cancel-redemption", kwargs={"pk": str(redemption.id)}),
    )

    assert response.status_code == status.HTTP_200_OK
    account.refresh_from_db()
    reward.refresh_from_db()
    redemption.refresh_from_db()
    assert account.current_points == 100
    assert reward.available_quantity == 1
    assert redemption.status.code == "cancelled"


def test_customer_cannot_cancel_applied_redemption(api_client: APIClient):
    user = UserFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0)
    restaurant = RestaurantFactory(display_name="La Brasa")
    account = LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=20,
        lifetime_points=100,
    )
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Postre",
        description="Brownie",
        points_cost=80,
        is_active=True,
    )
    tx_type, _ = LoyaltyTransactionType.objects.get_or_create(
        code="reward_redeemed",
        defaults={"name": "Recompensa canjeada"},
    )
    applied_status, _ = LoyaltyRedemptionStatus.objects.get_or_create(
        code="applied",
        defaults={"name": "Aplicado"},
    )
    tx = LoyaltyTransaction.objects.create(
        loyalty_account=account,
        tx_type=tx_type,
        points_delta=-80,
        description="Canje de recompensa: Postre",
    )
    redemption = LoyaltyRedemption.objects.create(
        loyalty_transaction=tx,
        loyalty_reward=reward,
        status=applied_status,
        points_applied=80,
    )

    api_client.force_authenticate(user=user)
    response = api_client.delete(
        reverse("api:customer-loyalty-cancel-redemption", kwargs={"pk": str(redemption.id)}),
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
