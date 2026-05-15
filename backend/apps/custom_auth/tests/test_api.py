import pytest
from django.conf import settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import UserProfile
from apps.restaurants.models import Restaurant
from apps.users.models import User
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


def test_register_success(api_client: APIClient):
    payload = {
        "email": "new-user@example.com",
        "name": "New User",
        "password": "StrongPassword123!",
        "password_confirm": "StrongPassword123!",
    }

    response = api_client.post(reverse("custom_auth:register"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert "access" in response.data
    assert response.data["user"]["email"] == payload["email"]
    assert response.data["user"]["role"] == "cliente"
    assert response.data["user"]["roles"] == ["cliente"]
    assert settings.JWT_REFRESH_COOKIE_NAME in response.cookies
    assert User.objects.filter(email=payload["email"]).exists()


def test_register_password_mismatch(api_client: APIClient):
    payload = {
        "email": "new-user@example.com",
        "name": "New User",
        "password": "StrongPassword123!",
        "password_confirm": "OtherPassword123!",
    }

    response = api_client.post(reverse("custom_auth:register"), payload, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "password_confirm" in response.data


def test_login_success_sets_cookie(api_client: APIClient):
    raw_password = "StrongPassword123!"
    user = UserFactory.create(password=raw_password)

    response = api_client.post(
        reverse("custom_auth:login"),
        {"email": user.email, "password": raw_password},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["user"]["email"] == user.email
    assert "access" in response.data
    assert settings.JWT_REFRESH_COOKIE_NAME in response.cookies
    cookie = response.cookies[settings.JWT_REFRESH_COOKIE_NAME]
    assert cookie["httponly"]


def test_refresh_token_lifetime_is_24_hours(api_client: APIClient):
    user = UserFactory.create()

    refresh = RefreshToken.for_user(user)

    lifetime = refresh.payload["exp"] - refresh.payload["iat"]
    expected_lifetime = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    assert lifetime == expected_lifetime


def test_login_invalid_credentials(api_client: APIClient):
    UserFactory.create(password="StrongPassword123!")

    response = api_client.post(
        reverse("custom_auth:login"),
        {"email": "wrong@example.com", "password": "badpass"},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_refresh_with_cookie(api_client: APIClient):
    raw_password = "StrongPassword123!"
    user = UserFactory.create(password=raw_password)
    login_response = api_client.post(
        reverse("custom_auth:login"),
        {"email": user.email, "password": raw_password},
        format="json",
    )

    refresh_cookie = login_response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
    api_client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_cookie

    response = api_client.post(reverse("custom_auth:refresh"), {}, format="json")

    assert response.status_code == status.HTTP_200_OK
    assert "access" in response.data
    assert settings.JWT_REFRESH_COOKIE_NAME in response.cookies


def test_refresh_without_cookie_or_body(api_client: APIClient):
    response = api_client.post(reverse("custom_auth:refresh"), {}, format="json")
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_refresh_invalid_token(api_client: APIClient):
    response = api_client.post(
        reverse("custom_auth:refresh"),
        {"refresh": "invalid-token"},
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_logout_clears_cookie(api_client: APIClient):
    raw_password = "StrongPassword123!"
    user = UserFactory.create(password=raw_password)
    login_response = api_client.post(
        reverse("custom_auth:login"),
        {"email": user.email, "password": raw_password},
        format="json",
    )
    refresh_cookie = login_response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
    api_client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = refresh_cookie

    response = api_client.post(reverse("custom_auth:logout"), {}, format="json")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert settings.JWT_REFRESH_COOKIE_NAME in response.cookies


def test_register_owner_maps_to_restaurant_role(api_client: APIClient):
    payload = {
        "email": "owner-user@example.com",
        "name": "Owner User",
        "phone": "+57 300 111 2233",
        "password": "StrongPassword123!",
        "password_confirm": "StrongPassword123!",
        "user_type": "dueno",
        "restaurant_name": "Sazon del Pacifico",
        "restaurant_address": "Calle 8 #12-44",
    }

    response = api_client.post(reverse("custom_auth:register"), payload, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["user"]["role"] == "restaurante"
    assert response.data["user"]["roles"] == ["restaurante", "cliente"]
    restaurant = Restaurant.objects.get(owner__email=payload["email"])
    profile = UserProfile.objects.get(user__email=payload["email"])
    assert restaurant.display_name == payload["restaurant_name"]
    assert restaurant.email == payload["email"]
    assert restaurant.phone == payload["phone"]
    assert (
        restaurant.addresses.get(is_primary=True).line1 == payload["restaurant_address"]
    )
    assert profile.phone == payload["phone"]


def test_refresh_rotates_cookie_and_blacklists_previous(api_client: APIClient):
    raw_password = "StrongPassword123!"
    user = UserFactory.create(password=raw_password)
    login_response = api_client.post(
        reverse("custom_auth:login"),
        {"email": user.email, "password": raw_password},
        format="json",
    )
    old_refresh = login_response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
    api_client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = old_refresh

    first_refresh_response = api_client.post(
        reverse("custom_auth:refresh"),
        {},
        format="json",
    )
    assert first_refresh_response.status_code == status.HTTP_200_OK

    new_refresh = first_refresh_response.cookies[settings.JWT_REFRESH_COOKIE_NAME].value
    assert new_refresh != old_refresh

    api_client.cookies[settings.JWT_REFRESH_COOKIE_NAME] = old_refresh
    second_refresh_response = api_client.post(
        reverse("custom_auth:refresh"),
        {},
        format="json",
    )
    assert second_refresh_response.status_code == status.HTTP_400_BAD_REQUEST


def test_me_requires_authentication(api_client: APIClient):
    response = api_client.get(reverse("custom_auth:me"))
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_me_authenticated(api_client: APIClient):
    user = UserFactory.create()
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("custom_auth:me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["email"] == user.email


def test_me_includes_multiple_roles_for_admin_user(api_client: APIClient):
    user = UserFactory.create()
    from apps.accounts.models import Role
    from apps.accounts.models import UserRole

    admin_role, _ = Role.objects.get_or_create(code="admin", defaults={"name": "Admin"})
    UserRole.objects.get_or_create(user=user, role=admin_role)
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("custom_auth:me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["roles"] == ["admin", "cliente"]
