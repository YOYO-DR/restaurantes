import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.loyalty.services import redeem_reward
from apps.menu.models import MenuItemLoyaltyConfig
from apps.restaurants.tests.factories import CustomerAddressFactory
from apps.restaurants.tests.factories import MenuCategoryFactory
from apps.restaurants.tests.factories import MenuItemFactory
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantAddressFactory
from apps.restaurants.tests.factories import RestaurantDeliverySettingFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.restaurants.tests.factories import RestaurantOrderCapabilityFactory
from apps.users.tests.factories import UserFactory


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def assign_role(user, code: str):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def setup_checkout_data(user):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderTypeFactory(code="pickup", name="Pickup")
    OrderTypeFactory(code="table", name="Mesa")
    OrderStatusFactory(code="new", name="Nuevo")
    OrderStatusFactory(code="preparing", name="Preparando")
    OrderStatusFactory(code="ready", name="Listo")
    OrderStatusFactory(code="delivered", name="Entregado")
    OrderStatusFactory(code="completed", name="Completado")
    OrderStatusFactory(code="cancelled", name="Cancelado")

    restaurant = RestaurantFactory()
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(restaurant=restaurant, table_order_enabled=True)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(
        restaurant=restaurant,
        slug="principales",
        name="Principales",
    )
    item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        slug="plato-principal",
        name="Plato principal",
        price_amount="20000.00",
    )
    address = CustomerAddressFactory(user=user)
    return restaurant, item, address


def test_pickup_completed_status_assigns_points(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant, item, _address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])

    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "pickup",
            "customer_email": customer.email,
            "customer_phone": "3001234567",
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    api_client.force_authenticate(user=owner)
    status_response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": create_response.data["id"]}),
        {"status_code": "completed"},
        format="json",
    )
    assert status_response.status_code == status.HTTP_200_OK

    account = LoyaltyAccount.objects.get(user=customer, restaurant=restaurant)
    assert account.current_points == 20


def test_pickup_delivered_status_assigns_points(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant, item, _address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])

    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "pickup",
            "customer_email": customer.email,
            "customer_phone": "3001234567",
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    api_client.force_authenticate(user=owner)
    status_response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": create_response.data["id"]}),
        {"status_code": "delivered"},
        format="json",
    )
    assert status_response.status_code == status.HTTP_200_OK

    account = LoyaltyAccount.objects.get(user=customer, restaurant=restaurant)
    assert account.current_points == 20


def test_cancel_completed_order_reverts_points(api_client: APIClient):
    customer = UserFactory()
    owner = UserFactory()
    assign_role(owner, "restaurante")
    restaurant, item, _address = setup_checkout_data(customer)
    restaurant.owner = owner
    restaurant.save(update_fields=["owner"])

    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "pickup",
            "customer_email": customer.email,
            "customer_phone": "3001234567",
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )
    assert create_response.status_code == status.HTTP_201_CREATED

    api_client.force_authenticate(user=owner)
    status_response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": create_response.data["id"]}),
        {"status_code": "completed"},
        format="json",
    )
    assert status_response.status_code == status.HTTP_200_OK

    cancel_response = api_client.patch(
        reverse("api:owner-order-cancel", kwargs={"pk": create_response.data["id"]}),
        {"reason": "Cancelacion operativa"},
        format="json",
    )
    assert cancel_response.status_code == status.HTTP_200_OK

    account = LoyaltyAccount.objects.get(user=customer, restaurant=restaurant)
    assert account.current_points == 0


def test_checkout_applies_redemption_discount(api_client: APIClient):
    customer = UserFactory()
    restaurant, item, _address = setup_checkout_data(customer)

    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_redeemable_points_per_order=150,
        point_redeem_value="1.00",
    )
    account = LoyaltyAccount.objects.create(
        user=customer,
        restaurant=restaurant,
        tier=tier,
        current_points=300,
        lifetime_points=300,
    )
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Canje rapido",
        points_cost=150,
        is_active=True,
    )
    redemption = redeem_reward(customer, reward)
    account.refresh_from_db()
    assert account.current_points == 150

    MenuItemLoyaltyConfig.objects.create(
        menu_item=item,
        allows_points_redemption=True,
        min_points_redeemable=50,
        max_points_redeemable=150,
    )

    api_client.force_authenticate(user=customer)
    create_response = api_client.post(
        reverse("api:checkout-order-list"),
        {
            "restaurant_id": str(restaurant.id),
            "order_type": "pickup",
            "customer_email": customer.email,
            "customer_phone": "3001234567",
            "loyalty_redemption_id": str(redemption.id),
            "line_redemptions": [
                {
                    "order_item_index": 0,
                    "points_to_apply": 120,
                },
            ],
            "items": [{"menu_item_id": str(item.id), "quantity": 1}],
        },
        format="json",
    )

    assert create_response.status_code == status.HTTP_201_CREATED
    assert create_response.data["discount_amount"] == "120.00"
    assert create_response.data["total_amount"] == "19880.00"
