import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserProfile
from apps.accounts.models import UserRole
from apps.accounts.models import UserStatus
from apps.orders.models import Order
from apps.platform_config.models import PlatformSecuritySetting
from apps.platform_config.models import PlatformSetting
from apps.restaurants.models import RestaurantReview
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


def test_account_profile_requires_authentication(api_client: APIClient):
    response = api_client.get(reverse("api:account-profile-list"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_account_profile_returns_authenticated_user_data(api_client: APIClient):
    user = UserFactory(name="Ana Torres", email="ana@example.com")
    active_status = UserStatus.objects.create(code="active", name="Activo")
    UserProfile.objects.create(
        user=user,
        status=active_status,
        phone="3001234567",
        avatar_url="https://example.com/avatar.jpg",
    )
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api:account-profile-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["email"] == user.email
    assert response.data["phone"] == "3001234567"
    assert response.data["avatar_url"] == "https://example.com/avatar.jpg"


def test_account_profile_partial_update_updates_authenticated_user(
    api_client: APIClient,
):
    user = UserFactory(name="Ana Torres", email="ana@example.com")
    api_client.force_authenticate(user=user)

    response = api_client.patch(
        reverse("api:account-profile-detail", kwargs={"pk": user.id}),
        {
            "name": "Ana Maria Torres",
            "phone": "3007654321",
            "avatar_url": "https://example.com/new-avatar.jpg",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    user.refresh_from_db()
    assert user.name == "Ana Maria Torres"
    assert user.profile.phone == "3007654321"
    assert user.profile.avatar_url == "https://example.com/new-avatar.jpg"


def test_admin_dashboard_requires_admin_role(api_client: APIClient):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api:admin-dashboard-list"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_admin_dashboard_returns_platform_metrics(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory()
    customer = UserFactory()
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")

    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    order_status = OrderStatusFactory(code="new", name="Nuevo")
    restaurant = RestaurantFactory(owner=owner, display_name="Sazon Central")
    RestaurantAddressFactory(restaurant=restaurant, city="Corinto")
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    category = MenuCategoryFactory(restaurant=restaurant, name="Almuerzos")
    item = MenuItemFactory(
        restaurant=restaurant, menu_category=category, name="Bandeja"
    )
    CustomerAddressFactory(user=customer)
    order = Order.objects.create(
        order_code="ADM-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=order_status,
        subtotal_amount="25000.00",
        total_amount="25000.00",
        currency_code="COP",
    )
    RestaurantReview.objects.create(
        restaurant=restaurant,
        user=customer,
        order=order,
        rating=5,
        comment="Muy bueno",
    )

    api_client.force_authenticate(user=admin)
    response = api_client.get(reverse("api:admin-dashboard-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_users"] >= 3
    assert response.data["metrics"]["active_restaurants"] >= 1
    assert response.data["metrics"]["total_orders"] >= 1
    assert response.data["metrics"]["total_revenue"] >= 25000
    assert len(response.data["monthly_performance"]) == 6
    assert any(
        item["label"] == "Admins" and item["count"] >= 1
        for item in response.data["role_distribution"]
    )
    assert any(
        top_restaurant["name"] == "Sazon Central"
        for top_restaurant in response.data["top_restaurants"]
    )


def test_admin_dashboard_filters_completed_orders_metrics(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory()
    customer = UserFactory()
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    preparing_status = OrderStatusFactory(code="preparing", name="Preparando")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    restaurant = RestaurantFactory(owner=owner)

    Order.objects.create(
        order_code="ADM-COMP-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=delivered_status,
        subtotal_amount="10000.00",
        total_amount="10000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="ADM-COMP-002",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=preparing_status,
        subtotal_amount="7000.00",
        total_amount="7000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-dashboard-list"), {"order_scope": "completed"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_orders"] == 1
    assert response.data["metrics"]["total_revenue"] == 10000


def test_admin_dashboard_non_completed_excludes_cancelled(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory()
    customer = UserFactory()
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    cancelled_status = OrderStatusFactory(code="cancelled", name="Cancelado")
    preparing_status = OrderStatusFactory(code="preparing", name="Preparando")
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    restaurant = RestaurantFactory(owner=owner)

    Order.objects.create(
        order_code="ADM-NON-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=cancelled_status,
        subtotal_amount="4000.00",
        total_amount="4000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="ADM-NON-002",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=preparing_status,
        subtotal_amount="7000.00",
        total_amount="7000.00",
        currency_code="COP",
    )
    Order.objects.create(
        order_code="ADM-NON-003",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=delivered_status,
        subtotal_amount="9000.00",
        total_amount="9000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-dashboard-list"),
        {"order_scope": "non_completed"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["metrics"]["total_orders"] == 1
    assert response.data["metrics"]["total_revenue"] == 7000


def test_admin_users_list_returns_real_users(api_client: APIClient):
    admin = UserFactory()
    customer = UserFactory(name="Laura Gomez", email="laura@example.com")
    owner = UserFactory(name="Carlos Owner", email="owner@example.com")
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")

    api_client.force_authenticate(user=admin)
    response = api_client.get(reverse("api:admin-users-list"), {"name": "Laura"})

    assert response.status_code == status.HTTP_200_OK
    assert response.data["counts"]["total"] == 1
    assert response.data["results"][0]["email"] == customer.email
    assert response.data["results"][0]["role"] == "cliente"


def test_admin_users_list_supports_pagination_and_ordering(api_client: APIClient):
    admin = UserFactory()
    assign_role(admin, "admin")
    UserFactory(name="Ana", email="ana@sort-suite.local")
    UserFactory(name="Bea", email="bea@sort-suite.local")
    third_user = UserFactory(name="Carla", email="carla@sort-suite.local")

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-users-list"),
        {
            "page": 2,
            "page_size": 2,
            "ordering": "name",
            "email": "sort-suite.local",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["page"] == 2
    assert response.data["page_size"] == 2
    assert response.data["total_pages"] >= 2
    assert [user["name"] for user in response.data["results"]] == [third_user.name]


def test_admin_users_list_supports_column_filters(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory(name="Daniel Owner", email="daniel@example.com")
    customer = UserFactory(name="Diana Cliente", email="diana@example.com")
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    UserProfile.objects.create(
        user=owner,
        status=UserStatus.objects.create(code="inactive", name="Inactivo"),
        phone="555111",
    )
    UserProfile.objects.create(
        user=customer,
        status=UserStatus.objects.get_or_create(
            code="active", defaults={"name": "Activo"}
        )[0],
        phone="300999",
    )

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-users-list"),
        {
            "name": "Daniel",
            "email": "example.com",
            "phone": "555",
            "role": "restaurante",
            "status": "inactive",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["counts"]["total"] == 1
    assert response.data["results"][0]["email"] == owner.email


def test_admin_restaurants_list_returns_real_restaurants(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory(name="Carlos Owner", email="owner@example.com")
    customer = UserFactory()
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    order_status = OrderStatusFactory(code="new", name="Nuevo")
    restaurant = RestaurantFactory(owner=owner, display_name="Parrilla Central")
    Order.objects.create(
        order_code="ADM-REST-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=order_status,
        subtotal_amount="18000.00",
        total_amount="18000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-restaurants-list"), {"search": "Parrilla"}
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["counts"]["total"] == 1
    assert response.data["results"][0]["name"] == "Parrilla Central"
    assert response.data["results"][0]["orders_count"] == 1


def test_admin_restaurant_can_be_updated(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory()
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner, display_name="Fogon Base")
    restaurant.status = restaurant.status.__class__.objects.create(
        code="inactive",
        name="Inactivo",
    )
    restaurant.save(update_fields=["status"])

    api_client.force_authenticate(user=admin)
    response = api_client.patch(
        reverse("api:admin-restaurants-detail", kwargs={"pk": restaurant.id}),
        {
            "display_name": "Fogon Premium",
            "status": "inactive",
            "description": "Pausado por revision administrativa",
            "delivery_enabled": False,
            "pickup_enabled": True,
        },
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    restaurant.refresh_from_db()
    restaurant.order_capability.refresh_from_db()
    assert restaurant.display_name == "Fogon Premium"
    assert restaurant.status.code == "inactive"
    assert restaurant.description == "Pausado por revision administrativa"
    assert restaurant.order_capability.delivery_enabled is False
    assert restaurant.order_capability.pickup_enabled is True


def test_admin_restaurants_list_supports_pagination_and_ordering(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory(name="Owner Paginado")
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")

    RestaurantFactory(owner=owner, display_name="Asados Mesa")
    RestaurantFactory(owner=owner, display_name="Bistro Mesa")
    third_restaurant = RestaurantFactory(owner=owner, display_name="Cafe Mesa")

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-restaurants-list"),
        {
            "page": 2,
            "page_size": 2,
            "ordering": "name",
            "name": "Mesa",
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["page"] == 2
    assert response.data["page_size"] == 2
    assert response.data["total_pages"] >= 2
    assert [restaurant["name"] for restaurant in response.data["results"]] == [
        third_restaurant.display_name
    ]


def test_admin_restaurants_list_supports_column_filters(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory(name="Patricia Owner", email="patricia@example.com")
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner, display_name="Patio Central")

    api_client.force_authenticate(user=admin)
    response = api_client.get(
        reverse("api:admin-restaurants-list"),
        {
            "name": "Patio",
            "owner": "Patricia",
            "status": restaurant.status.code,
        },
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.data["counts"]["total"] == 1
    assert response.data["results"][0]["name"] == restaurant.display_name


def test_admin_reports_returns_aggregated_data(api_client: APIClient):
    admin = UserFactory()
    owner = UserFactory()
    customer = UserFactory()
    assign_role(admin, "admin")
    assign_role(owner, "restaurante")
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    order_status = OrderStatusFactory(code="delivered", name="Entregado")
    restaurant = RestaurantFactory(owner=owner, display_name="Fogon Urbano")
    Order.objects.create(
        order_code="ADM-REP-001",
        user=customer,
        restaurant=restaurant,
        order_type=order_type,
        status=order_status,
        subtotal_amount="21000.00",
        total_amount="21000.00",
        currency_code="COP",
    )

    api_client.force_authenticate(user=admin)
    response = api_client.get(reverse("api:admin-reports-list"))

    assert response.status_code == status.HTTP_200_OK
    assert len(response.data["daily_trends"]) == 7
    assert any(item["value"] >= 1 for item in response.data["order_type_distribution"])
    assert len(response.data["insights"]) >= 1


def test_admin_settings_can_be_read_and_updated(api_client: APIClient):
    admin = UserFactory()
    assign_role(admin, "admin")

    api_client.force_authenticate(user=admin)
    response = api_client.get(reverse("api:admin-settings-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.data["general"]["platform_name"] == "FoodHub"

    patch_response = api_client.patch(
        reverse("api:admin-settings-detail", kwargs={"pk": "_"}),
        {
            "general": {
                "platform_name": "FoodHub Pro",
                "support_email": "admin@foodhub.com",
            },
            "security": {
                "require_2fa_admin": True,
                "backup_retention_days": 45,
                "backup_frequency": "daily",
            },
        },
        format="json",
    )

    assert patch_response.status_code == status.HTTP_200_OK
    assert patch_response.data["general"]["platform_name"] == "FoodHub Pro"
    assert patch_response.data["security"]["require_2fa_admin"] is True
    assert patch_response.data["security"]["backup_retention_days"] == 45
    assert PlatformSetting.objects.filter(platform_name="FoodHub Pro").exists()
    assert PlatformSecuritySetting.objects.filter(require_2fa_admin=True).exists()
