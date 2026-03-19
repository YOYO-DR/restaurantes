import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.orders.models import Order
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


pytestmark = pytest.mark.django_db


def assign_owner_role(user):
    role, _ = Role.objects.get_or_create(
        code="restaurante", defaults={"name": "Restaurante"}
    )
    UserRole.objects.get_or_create(user=user, role=role)


def test_owner_dashboard_filters_completed_orders_metrics():
    api_client = APIClient()
    owner = UserFactory()
    customer = UserFactory()
    assign_owner_role(owner)
    restaurant = RestaurantFactory(owner=owner)
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    preparing_status = OrderStatusFactory(code="preparing", name="Preparando")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")

    Order.objects.create(
        order_code="OWN-DASH-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=delivered_status,
        subtotal_amount="20000.00",
        total_amount="20000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="OWN-DASH-002",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=preparing_status,
        subtotal_amount="5000.00",
        total_amount="5000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.get(
        reverse("api:owner-restaurant-dashboard", kwargs={"pk": restaurant.id}),
        {"order_scope": "completed"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["orders_today"] == 1
    assert response.data["metrics"]["sales_today"] == 20000


def test_owner_analytics_filters_non_completed_orders_metrics():
    api_client = APIClient()
    owner = UserFactory()
    customer = UserFactory()
    assign_owner_role(owner)
    restaurant = RestaurantFactory(owner=owner)
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    new_status = OrderStatusFactory(code="new", name="Nuevo")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")

    Order.objects.create(
        order_code="OWN-ANA-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=delivered_status,
        subtotal_amount="12000.00",
        total_amount="12000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="OWN-ANA-002",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=new_status,
        subtotal_amount="8000.00",
        total_amount="8000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.get(
        reverse("api:owner-restaurant-analytics", kwargs={"pk": restaurant.id}),
        {"order_scope": "non_completed"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["sales"]["today"]["orders"] == 1
    assert response.data["sales"]["today"]["value"] == 8000


def test_owner_customers_filters_non_completed_excluding_cancelled():
    api_client = APIClient()
    owner = UserFactory()
    customer = UserFactory()
    assign_owner_role(owner)
    restaurant = RestaurantFactory(owner=owner)
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    cancelled_status = OrderStatusFactory(code="cancelled", name="Cancelado")
    preparing_status = OrderStatusFactory(code="preparing", name="Preparando")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")

    Order.objects.create(
        order_code="OWN-CUS-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=delivered_status,
        subtotal_amount="12000.00",
        total_amount="12000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="OWN-CUS-002",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=cancelled_status,
        subtotal_amount="6000.00",
        total_amount="6000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="OWN-CUS-003",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=preparing_status,
        subtotal_amount="9000.00",
        total_amount="9000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=owner)
    response = api_client.get(
        reverse("api:owner-restaurant-customers", kwargs={"pk": restaurant.id}),
        {"order_scope": "non_completed"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_customers"] == 1
    assert response.data["customers"][0]["total_orders"] == 1
    assert response.data["customers"][0]["total_spent"] == 9000
