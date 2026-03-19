import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.orders.models import Order
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


pytestmark = pytest.mark.django_db


def test_customer_dashboard_filters_completed_orders_metrics():
    api_client = APIClient()
    user = UserFactory()
    restaurant = RestaurantFactory()
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    new_status = OrderStatusFactory(code="new", name="Nuevo")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")

    Order.objects.create(
        order_code="CUS-COMP-001",
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=delivered_status,
        subtotal_amount="15000.00",
        total_amount="15000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="CUS-COMP-002",
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=new_status,
        subtotal_amount="9000.00",
        total_amount="9000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=user)
    response = api_client.get(
        reverse("api:customer-dashboard-list"), {"order_scope": "completed"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_orders"] == 1
    assert all(
        order["status_code"] == "delivered" for order in response.data["recent_orders"]
    )
