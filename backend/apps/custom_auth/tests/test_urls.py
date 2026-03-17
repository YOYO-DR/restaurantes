from django.urls import reverse


def test_auth_register_url():
    assert reverse("custom_auth:register") == "/api/auth/register/"


def test_auth_login_url():
    assert reverse("custom_auth:login") == "/api/auth/login/"


def test_auth_refresh_url():
    assert reverse("custom_auth:refresh") == "/api/auth/refresh/"


def test_auth_logout_url():
    assert reverse("custom_auth:logout") == "/api/auth/logout/"


def test_auth_me_url():
    assert reverse("custom_auth:me") == "/api/auth/me/"
