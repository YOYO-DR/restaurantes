import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.customers.models import Favorite
from apps.restaurants.tests.factories import CustomerAddressFactory
from apps.restaurants.tests.factories import RestaurantDeliverySettingFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.restaurants.tests.factories import RestaurantOrderCapabilityFactory
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def test_customer_addresses_require_authentication(api_client: APIClient):
    response = api_client.get(reverse("api:customer-address-list"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_customer_addresses_list_is_scoped_to_authenticated_user(api_client: APIClient):
    user = UserFactory()
    other_user = UserFactory()
    own_address = CustomerAddressFactory(user=user, label="Casa")
    CustomerAddressFactory(user=other_user, label="Oficina")
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api:customer-address-list"))

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.data] == [str(own_address.id)]


def test_customer_favorites_list_is_scoped_to_authenticated_user(api_client: APIClient):
    user = UserFactory()
    other_user = UserFactory()
    restaurant = RestaurantFactory()
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    other_restaurant = RestaurantFactory()
    RestaurantOrderCapabilityFactory(restaurant=other_restaurant)
    RestaurantDeliverySettingFactory(restaurant=other_restaurant)
    own_favorite = Favorite.objects.create(user=user, restaurant=restaurant)
    Favorite.objects.create(user=other_user, restaurant=other_restaurant)
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api:customer-favorite-list"))

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.data] == [str(own_favorite.id)]


def test_customer_address_create_requires_authentication(api_client: APIClient):
    response = api_client.post(
        reverse("api:customer-address-list"),
        {"label": "Casa", "line1": "Calle 5 #12-34", "city": "Corinto", "country": "Colombia"},
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_customer_address_create_without_address_type_defaults_to_home(api_client: APIClient):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("api:customer-address-list"),
        {"label": "Casa", "line1": "Calle 5 #12-34", "city": "Corinto", "country": "Colombia"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["address_type_code"] == "home"
    assert response.data["label"] == "Casa"
    assert response.data["city"] == "Corinto"


def test_customer_address_create_assigns_authenticated_user(api_client: APIClient):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("api:customer-address-list"),
        {"label": "Oficina", "line1": "Av Principal #1", "city": "Bogota", "country": "Colombia"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    from apps.customers.models import CustomerAddress
    address = CustomerAddress.objects.get(id=response.data["id"])
    assert address.user_id == user.id


def test_customer_address_create_returns_id_for_auto_selection(api_client: APIClient):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("api:customer-address-list"),
        {"label": "Casa", "line1": "Calle 10 #5-20", "city": "Cali", "country": "Colombia"},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert "id" in response.data
    assert response.data["line1"] == "Calle 10 #5-20"


def test_customer_favorites_create_assigns_authenticated_user(api_client: APIClient):
    user = UserFactory()
    restaurant = RestaurantFactory()
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("api:customer-favorite-list"),
        {"restaurant": str(restaurant.id)},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    favorite = Favorite.objects.get()
    assert favorite.user_id == user.id
    assert favorite.restaurant_id == restaurant.id
