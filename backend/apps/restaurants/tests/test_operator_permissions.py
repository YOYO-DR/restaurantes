"""
Tests exhaustivos de enforcement de permisos por módulo para operadores.
Valida que cada combinación de módulo/acción sea respetada en la API.
"""
import uuid
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.models import UserRole
from apps.menu.models import InventoryItem
from apps.menu.models import UnitType
from apps.restaurants.models import Operador
from apps.restaurants.models import OperatorPermission
from apps.restaurants.models import RestaurantReview
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
def api_client():
    return APIClient()


def _assign_role(user, code):
    role, _ = Role.objects.get_or_create(code=code, defaults={"name": code.title()})
    UserRole.objects.get_or_create(user=user, role=role)


def _make_operator(restaurant, permissions_map: dict):
    """
    Crea un operador con permisos específicos.
    permissions_map: { "menu": {"can_view": True, "can_create": False, ...} }
    """
    user = UserFactory()
    _assign_role(user, "operador")
    _assign_role(user, "cliente")
    operador = Operador.objects.create(user=user, restaurante=restaurant)
    for module, perms in permissions_map.items():
        OperatorPermission.objects.create(operator=operador, module=module, **perms)
    return user


def _make_restaurant_with_owner():
    owner = UserFactory()
    _assign_role(owner, "restaurante")
    restaurant = RestaurantFactory(owner=owner)
    RestaurantAddressFactory(restaurant=restaurant)
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    return owner, restaurant


def _make_category(restaurant):
    return MenuCategoryFactory(restaurant=restaurant, slug=f"cat-{restaurant.id}")


def _make_item(restaurant, category):
    return MenuItemFactory(restaurant=restaurant, menu_category=category, price_amount="10000.00")


def _make_inventory_item(restaurant):
    unit_type, _ = UnitType.objects.get_or_create(
        code="kg", defaults={"name": "Kilogramo"}
    )
    return InventoryItem.objects.create(
        restaurant=restaurant,
        unit_type=unit_type,
        name="Tomate",
        sku=f"TOM-{uuid.uuid4().hex[:6].upper()}",
        current_stock="10.00",
        min_stock="2.00",
        max_stock="50.00",
    )


# ─── Módulo MENÚ ─────────────────────────────────────────────────────────────

def test_operator_with_menu_can_view_lists_categories(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})
    _make_category(restaurant)

    api_client.force_authenticate(user=op)
    response = api_client.get(reverse("api:owner-menu-category-list"))

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_menu_can_view_cannot_list_categories(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"menu": {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(reverse("api:owner-menu-category-list"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_menu_can_create_creates_category(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.post(
        reverse("api:owner-menu-category-list"),
        {"restaurant": str(restaurant.id), "name": "Entradas", "slug": "entradas-op", "sort_order": 0, "is_active": True},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED


def test_operator_without_menu_can_create_cannot_create_category(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.post(
        reverse("api:owner-menu-category-list"),
        {"restaurant": str(restaurant.id), "name": "Entradas", "slug": "entradas-op2", "sort_order": 0, "is_active": True},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_menu_can_edit_updates_item(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    category = _make_category(restaurant)
    item = _make_item(restaurant, category)
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-menu-crud-item-detail", kwargs={"pk": item.id}),
        {"name": "Nombre actualizado"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_menu_can_edit_cannot_update_item(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    category = _make_category(restaurant)
    item = _make_item(restaurant, category)
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": True, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-menu-crud-item-detail", kwargs={"pk": item.id}),
        {"name": "Nombre actualizado"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_menu_can_delete_deletes_category(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    category = _make_category(restaurant)
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True}})

    api_client.force_authenticate(user=op)
    response = api_client.delete(
        reverse("api:owner-menu-category-detail", kwargs={"pk": category.id})
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT


def test_operator_without_menu_can_delete_cannot_delete_category(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    category = _make_category(restaurant)
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.delete(
        reverse("api:owner-menu-category-detail", kwargs={"pk": category.id})
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_menu_can_edit_toggles_item_availability(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    category = _make_category(restaurant)
    item = _make_item(restaurant, category)
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-menu-item-availability", kwargs={"pk": item.id}),
        {"is_available": False},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_menu_can_edit_cannot_toggle_availability(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    category = _make_category(restaurant)
    item = _make_item(restaurant, category)
    op = _make_operator(restaurant, {"menu": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-menu-item-availability", kwargs={"pk": item.id}),
        {"is_available": False},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ─── Módulo INVENTARIO ────────────────────────────────────────────────────────

def test_operator_with_inventario_can_view_lists_items(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    _make_inventory_item(restaurant)
    op = _make_operator(restaurant, {"inventario": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-inventory-item-list") + f"?restaurant={restaurant.id}"
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_inventario_can_view_cannot_list_items(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"inventario": {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-inventory-item-list") + f"?restaurant={restaurant.id}"
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_without_inventario_can_create_cannot_create_item(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    unit_type, _ = UnitType.objects.get_or_create(
        code="kg", defaults={"name": "Kilogramo"}
    )
    op = _make_operator(restaurant, {"inventario": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.post(
        reverse("api:owner-inventory-item-list"),
        {
            "restaurant": str(restaurant.id),
            "unit_type": str(unit_type.id),
            "name": "Cebolla",
            "sku": "CEB-001",
            "current_stock": "5.00",
            "min_stock": "1.00",
            "max_stock": "20.00",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_without_inventario_can_edit_cannot_update_item(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    item = _make_inventory_item(restaurant)
    op = _make_operator(restaurant, {"inventario": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-inventory-item-detail", kwargs={"pk": item.id}),
        {"name": "Tomate actualizado"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_inventario_can_edit_updates_item(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    item = _make_inventory_item(restaurant)
    op = _make_operator(restaurant, {"inventario": {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-inventory-item-detail", kwargs={"pk": item.id}),
        {"name": "Tomate fresco"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_inventario_can_create_cannot_register_movement(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    item = _make_inventory_item(restaurant)
    op = _make_operator(restaurant, {"inventario": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    from apps.menu.models import InventoryMovementType
    movement_type, _ = InventoryMovementType.objects.get_or_create(
        code="in", defaults={"name": "Entrada"}
    )
    response = api_client.post(
        reverse("api:owner-inventory-item-movements", kwargs={"pk": item.id}),
        {"movement_type": str(movement_type.id), "quantity": "5.00", "reason": "Compra"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ─── Módulo PEDIDOS ───────────────────────────────────────────────────────────

def _setup_order(restaurant):
    OrderTypeFactory(code="delivery", name="Delivery")
    OrderStatusFactory(code="new", name="Nuevo")
    OrderStatusFactory(code="preparing", name="Preparando")
    OrderStatusFactory(code="cancelled", name="Cancelado")
    from apps.orders.models import Order, OrderType, OrderStatus
    order_type = OrderType.objects.get(code="delivery")
    order_status = OrderStatus.objects.get(code="new")
    order = Order.objects.create(
        order_code=f"ORD-{uuid.uuid4().hex[:8].upper()}",
        restaurant=restaurant,
        order_type=order_type,
        status=order_status,
        subtotal_amount="10000.00",
        total_amount="10000.00",
        currency_code="COP",
    )
    return order


def test_operator_with_pedidos_can_view_lists_orders(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    _setup_order(restaurant)
    op = _make_operator(restaurant, {"pedidos": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(reverse("api:owner-order-list"))

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_pedidos_can_view_cannot_list_orders(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"pedidos": {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(reverse("api:owner-order-list"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_pedidos_can_edit_updates_order_status(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    order = _setup_order(restaurant)
    op = _make_operator(restaurant, {"pedidos": {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": order.id}),
        {"status_code": "preparing"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_pedidos_can_edit_cannot_update_order_status(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    order = _setup_order(restaurant)
    op = _make_operator(restaurant, {"pedidos": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-order-status", kwargs={"pk": order.id}),
        {"status_code": "preparing"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_without_pedidos_can_edit_cannot_cancel_order(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    order = _setup_order(restaurant)
    op = _make_operator(restaurant, {"pedidos": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.patch(
        reverse("api:owner-order-cancel", kwargs={"pk": order.id}),
        {"reason": "Sin stock"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ─── Módulo CLIENTES ──────────────────────────────────────────────────────────

def test_operator_with_clientes_can_view_sees_customers(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"clientes": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-restaurant-customers", kwargs={"pk": restaurant.id})
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_clientes_can_view_cannot_see_customers(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"clientes": {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-restaurant-customers", kwargs={"pk": restaurant.id})
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ─── Módulo ANALÍTICAS ────────────────────────────────────────────────────────

def test_operator_with_analiticas_can_view_sees_analytics(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"analiticas": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-restaurant-analytics", kwargs={"pk": restaurant.id})
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_analiticas_can_view_cannot_see_analytics(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"analiticas": {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-restaurant-analytics", kwargs={"pk": restaurant.id})
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ─── Módulo RESEÑAS ──────────────────────────────────────────────────────────

def _make_review(restaurant):
    from apps.restaurants.models import RestaurantReview
    user = UserFactory()
    return RestaurantReview.objects.create(
        restaurant=restaurant,
        user=user,
        rating=4,
        comment="Muy bueno",
    )


def test_operator_with_resenas_can_view_sees_reviews(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    _make_review(restaurant)
    op = _make_operator(restaurant, {"resenas": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-restaurant-reviews", kwargs={"pk": restaurant.id})
    )

    assert response.status_code == status.HTTP_200_OK


def test_operator_without_resenas_can_view_cannot_see_reviews(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    op = _make_operator(restaurant, {"resenas": {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.get(
        reverse("api:owner-restaurant-reviews", kwargs={"pk": restaurant.id})
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_operator_with_resenas_can_edit_can_reply_to_review(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    review = _make_review(restaurant)
    op = _make_operator(restaurant, {"resenas": {"can_view": True, "can_create": False, "can_edit": True, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.post(
        reverse("api:owner-restaurant-reply-review", kwargs={"pk": restaurant.id, "review_id": review.id}),
        {"response": "Gracias por tu reseña"},
        format="json",
    )

    assert response.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]


def test_operator_without_resenas_can_edit_cannot_reply_to_review(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    review = _make_review(restaurant)
    op = _make_operator(restaurant, {"resenas": {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}})

    api_client.force_authenticate(user=op)
    response = api_client.post(
        reverse("api:owner-restaurant-reply-review", kwargs={"pk": restaurant.id, "review_id": review.id}),
        {"response": "Gracias por tu reseña"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


# ─── Garantías: Owner y Admin nunca bloqueados ────────────────────────────────

def test_owner_always_can_access_menu_regardless_of_permissions(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    _make_category(restaurant)

    api_client.force_authenticate(user=owner)
    assert api_client.get(reverse("api:owner-menu-category-list")).status_code == status.HTTP_200_OK
    assert api_client.post(
        reverse("api:owner-menu-category-list"),
        {"restaurant": str(restaurant.id), "name": "Cat owner", "slug": "cat-owner", "sort_order": 0, "is_active": True},
        format="json",
    ).status_code == status.HTTP_201_CREATED


def test_owner_always_can_access_inventory_regardless_of_permissions(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    unit_type, _ = UnitType.objects.get_or_create(
        code="kg", defaults={"name": "Kilogramo"}
    )

    api_client.force_authenticate(user=owner)
    response = api_client.post(
        reverse("api:owner-inventory-item-list"),
        {
            "restaurant": str(restaurant.id),
            "unit_type": str(unit_type.id),
            "name": "Lechuga",
            "sku": "LEC-001",
            "current_stock": "5.00",
            "min_stock": "1.00",
            "max_stock": "20.00",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED


def test_owner_always_can_view_orders(api_client):
    owner, restaurant = _make_restaurant_with_owner()
    _setup_order(restaurant)

    api_client.force_authenticate(user=owner)
    assert api_client.get(reverse("api:owner-order-list")).status_code == status.HTTP_200_OK


def test_operator_with_no_permissions_at_all_is_blocked_everywhere(api_client):
    """Operador sin ningún OperatorPermission registrado no puede acceder a nada."""
    owner, restaurant = _make_restaurant_with_owner()
    user = UserFactory()
    _assign_role(user, "operador")
    Operador.objects.create(user=user, restaurante=restaurant)
    # Sin OperatorPermission → operator_can retorna False para todo

    api_client.force_authenticate(user=user)
    assert api_client.get(reverse("api:owner-menu-category-list")).status_code == status.HTTP_403_FORBIDDEN
    assert api_client.get(reverse("api:owner-order-list")).status_code == status.HTTP_403_FORBIDDEN
    assert api_client.get(
        reverse("api:owner-inventory-item-list") + f"?restaurant={restaurant.id}"
    ).status_code == status.HTTP_403_FORBIDDEN


def test_operator_cannot_access_other_restaurants_resources(api_client):
    """Operador asignado a restaurante A no puede acceder a categorías del restaurante B."""
    owner_a, restaurant_a = _make_restaurant_with_owner()
    owner_b, restaurant_b = _make_restaurant_with_owner()
    category_b = _make_category(restaurant_b)

    op = _make_operator(restaurant_a, {"menu": {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True}})

    api_client.force_authenticate(user=op)
    response = api_client.delete(
        reverse("api:owner-menu-category-detail", kwargs={"pk": category_b.id})
    )

    assert response.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]
