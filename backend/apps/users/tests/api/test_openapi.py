from http import HTTPStatus

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    user = UserFactory(is_superuser=True, is_staff=True)
    return user


@pytest.mark.django_db
def test_api_docs_accessible_by_admin(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    url = reverse("api-docs")
    response = api_client.get(url)
    assert response.status_code == HTTPStatus.OK


@pytest.mark.django_db
def test_api_docs_not_accessible_by_anonymous_users(api_client):
    url = reverse("api-docs")
    response = api_client.get(url)
    assert response.status_code in {HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN}


@pytest.mark.django_db
def test_api_schema_generated_successfully(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    url = reverse("api-schema")
    response = api_client.get(url)
    assert response.status_code == HTTPStatus.OK
