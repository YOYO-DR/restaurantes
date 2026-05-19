from decimal import Decimal

import pytest

from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.loyalty.services import apply_direct_line_redemptions
from apps.loyalty.services import assign_points_for_order
from apps.loyalty.services import revert_points_for_order
from apps.menu.models import MenuItemLoyaltyConfig
from apps.orders.models import Order
from apps.orders.models import OrderItem
from apps.restaurants.tests.factories import MenuCategoryFactory
from apps.restaurants.tests.factories import MenuItemFactory
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


pytestmark = pytest.mark.django_db


def _setup(
    point_redeem_value="5",
    currency_unit_amount="1000",
    points_earned=2,
    max_per_order=None,
    min_payment_denomination=None,
):
    restaurant = RestaurantFactory()
    setting = RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount=currency_unit_amount,
        points_earned=points_earned,
        point_redeem_value=point_redeem_value,
        max_redeemable_points_per_order=max_per_order,
        min_payment_denomination=min_payment_denomination,
    )
    user = UserFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    account = LoyaltyAccount.objects.create(
        user=user, restaurant=restaurant, current_points=500, lifetime_points=500, tier=tier
    )
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(restaurant=restaurant, menu_category=category, price_amount="10000.00")
    MenuItemLoyaltyConfig.objects.create(
        menu_item=item,
        earns_points=True,
        allows_points_redemption=True,
        min_points_redeemable=10,
        max_points_redeemable=400,
    )
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    status = OrderStatusFactory(code="new", name="Nuevo")
    order = Order.objects.create(
        order_code="ORD-DIRECT-001",
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount="10000.00",
        total_amount="10000.00",
    )
    order_item = OrderItem.objects.create(
        order=order,
        menu_item=item,
        item_name_snapshot=item.name,
        unit_price_amount="10000.00",
        quantity=1,
        line_total_amount="10000.00",
    )
    return account, order, order_item, setting


def test_direct_redemption_happy_path():
    account, order, order_item, _ = _setup()
    discount = apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])

    assert discount == Decimal("500.00")  # 100 pts * 5 = 500 pesos
    account.refresh_from_db()
    assert account.current_points == 400  # 500 - 100

    redemptions = LoyaltyRedemption.objects.filter(order=order)
    assert redemptions.count() == 1
    r = redemptions.first()
    assert r.order_item_id == order_item.id
    assert r.points_applied == 100
    assert r.is_direct is True
    assert r.loyalty_reward is None
    assert r.status.code == "applied"

    tx = LoyaltyTransaction.objects.filter(order=order).first()
    assert tx.points_delta == -100
    assert tx.tx_type.code == "direct_redemption"


def test_direct_redemption_idempotence_deducts_once():
    account, order, _, _ = _setup()
    apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 50}])
    account.refresh_from_db()
    assert account.current_points == 450


def test_direct_redemption_no_eligible_item_raises():
    account, order, order_item, _ = _setup()
    # Quitar el permiso de canje del item
    MenuItemLoyaltyConfig.objects.filter(menu_item=order_item.menu_item).update(allows_points_redemption=False)
    with pytest.raises(ValueError, match="no admite canje"):
        apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])


def test_direct_redemption_below_minimum_raises():
    account, order, order_item, _ = _setup()
    # min_points_redeemable = 10 en el setup
    with pytest.raises(ValueError, match="al menos"):
        apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 5}])


def test_direct_redemption_above_maximum_raises():
    account, order, order_item, _ = _setup()
    # max_points_redeemable = 400 en el setup
    with pytest.raises(ValueError, match="Superaste el maximo"):
        apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 500}])


def test_direct_redemption_cap_by_price():
    """
    B3: descuento no puede exceder el precio del item.
    item cuesta 10000, point_redeem_value=5 → max por precio = floor(10000/5) = 2000 pts.
    Pedir 2100 pts debe fallar.
    """
    account, order, _, _ = _setup(point_redeem_value="5")
    # Subir el max_points_redeemable a 3000 para no ser bloqueados por ese límite
    item = order.items.first().menu_item
    MenuItemLoyaltyConfig.objects.filter(menu_item=item).update(max_points_redeemable=3000)
    # El cap por precio debe bloquearlo a 2000
    with pytest.raises(ValueError, match="exceden el precio"):
        apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 2100}])


def test_direct_redemption_insufficient_balance_raises():
    account, order, _, _ = _setup()
    account.current_points = 30
    account.save(update_fields=["current_points"])
    with pytest.raises(ValueError, match="No tienes puntos suficientes"):
        apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])


def test_direct_redemption_respects_global_cap():
    account, order, _, setting = _setup(max_per_order=50)
    account.current_points = 500
    account.save(update_fields=["current_points"])
    with pytest.raises(ValueError, match="maximo.*puntos por pedido"):
        apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])


def test_direct_redemption_zero_points_skipped():
    account, order, _, _ = _setup()
    discount = apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 0}])
    assert discount == Decimal("0.00")
    account.refresh_from_db()
    assert account.current_points == 500  # sin cambios


def test_denomination_no_adjustment_when_total_already_multiple():
    """
    Si el total a pagar ya es multiplo de la denominacion, no hay ajuste.
    total = 10000, descuento = 500 (100 pts * 5), total_after = 9500.
    9500 % 100 == 0 → no hay ajuste.
    """
    account, order, _, _ = _setup(min_payment_denomination=100)
    discount = apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])
    assert discount == Decimal("500.00")
    account.refresh_from_db()
    assert account.current_points == 400


def test_denomination_reduces_points_to_round_up():
    """
    total = 10000, denominacion = 100, point_redeem_value = 5.
    Usuario quiere 103 pts → descuento = 515 → total_after = 9485.
    Multiplo siguiente hacia arriba: 9500.
    max_discount = 10000 - 9500 = 500 → adjusted_pts = floor(500/5) = 100.
    Descuento real = 500. Sobrantes = 3 pts quedan en cuenta.
    """
    account, order, _, _ = _setup(min_payment_denomination=100)
    account.current_points = 500
    account.save(update_fields=["current_points"])

    discount = apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 103}])

    assert discount == Decimal("500.00")  # 100 pts * 5
    account.refresh_from_db()
    assert account.current_points == 400  # 500 - 100 (los 3 sobrantes NO se descontaron)

    tx = LoyaltyTransaction.objects.filter(order=order, tx_type__code="direct_redemption").first()
    assert tx.points_delta == -100  # solo 100 pts aplicados


def test_denomination_null_means_no_restriction():
    """
    Si min_payment_denomination es None, no hay restriccion y se aplican todos los puntos.
    """
    account, order, _, _ = _setup(min_payment_denomination=None)
    account.current_points = 500
    account.save(update_fields=["current_points"])

    discount = apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 103}])

    assert discount == Decimal("515.00")  # 103 * 5 = 515, sin ajuste
    account.refresh_from_db()
    assert account.current_points == 397  # 500 - 103


def test_denomination_with_custom_value():
    """
    denominacion = 50, point_redeem_value = 10.
    Usuario quiere 37 pts → descuento = 370 → total_after = 9630.
    Multiplo de 50 hacia arriba: 9650.
    max_discount = 10000 - 9650 = 350 → adjusted_pts = floor(350/10) = 35.
    Descuento real = 350. Sobrantes = 2 pts.
    """
    account, order, _, _ = _setup(point_redeem_value="10", min_payment_denomination=50)
    account.current_points = 500
    account.save(update_fields=["current_points"])
    item = order.items.first().menu_item
    MenuItemLoyaltyConfig.objects.filter(menu_item=item).update(max_points_redeemable=None)
    # Ajustar precio del item y order_item para no topar con el cap por precio
    # item price = 10000, max por precio = floor(10000/10) = 1000, suficiente

    discount = apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 37}])

    assert discount == Decimal("350.00")
    account.refresh_from_db()
    assert account.current_points == 465  # 500 - 35


def test_denomination_info_in_transaction_reflects_adjusted_points():
    """
    La LoyaltyTransaction debe reflejar los puntos AJUSTADOS (no los seleccionados).
    """
    account, order, _, _ = _setup(min_payment_denomination=100)
    account.current_points = 500
    account.save(update_fields=["current_points"])

    apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 103}])

    tx = LoyaltyTransaction.objects.filter(order=order).first()
    assert abs(tx.points_delta) == 100

    redemption = LoyaltyRedemption.objects.filter(order=order).first()
    assert redemption.points_applied == 100


def test_direct_redemption_excludes_redeemed_items_from_earning():
    """
    B1: items donde se aplico canje directo NO deben generar puntos al cerrar el pedido.
    """
    account, order, order_item, setting = _setup()
    apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])

    # Simular cierre del pedido
    delivered_status = OrderStatusFactory(code="delivered", name="Entregado")
    order.status = delivered_status
    order.save(update_fields=["status"])

    # assign_points_for_order no debe contar el item canjeado
    assign_points_for_order(order)

    # El item fue canjeado, así que eligible_total = 0 → no se asignan puntos
    earned_txs = LoyaltyTransaction.objects.filter(
        order=order,
        tx_type__code__in=["earned_purchase", "earned_purchase_capped"],
    )
    assert earned_txs.count() == 0


def test_cancel_order_returns_direct_redemption_points():
    """
    Bug reportado: al cancelar una orden con canje directo, los puntos no volvian.
    Despues del fix: revert_points_for_order devuelve los puntos descontados.
    """
    account, order, _, _ = _setup()
    initial_points = account.current_points  # 500

    apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])
    account.refresh_from_db()
    assert account.current_points == 400  # puntos descontados

    cancelled_status = OrderStatusFactory(code="cancelled", name="Cancelado")
    order.status = cancelled_status
    order.save(update_fields=["status"])

    revert_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == initial_points  # puntos devueltos

    # La transaccion de devolucion existe
    refund_tx = LoyaltyTransaction.objects.filter(
        order=order,
        tx_type__code="direct_redemption_refunded",
    ).first()
    assert refund_tx is not None
    assert refund_tx.points_delta == 100

    # El LoyaltyRedemption queda cancelado
    redemption = LoyaltyRedemption.objects.filter(order=order, is_direct=True).first()
    assert redemption.status.code == "cancelled"


def test_cancel_order_returns_direct_redemption_points_idempotent():
    """Llamar revert dos veces no devuelve los puntos dos veces."""
    account, order, _, _ = _setup()

    apply_direct_line_redemptions(order, [{"order_item_index": 0, "points_to_apply": 100}])
    cancelled_status = OrderStatusFactory(code="cancelled2", name="Cancelado2")
    order.status = cancelled_status
    order.save(update_fields=["status"])

    revert_points_for_order(order)
    revert_points_for_order(order)  # segunda llamada

    account.refresh_from_db()
    assert account.current_points == 500  # solo una devolucion

    refund_txs = LoyaltyTransaction.objects.filter(
        order=order,
        tx_type__code="direct_redemption_refunded",
    )
    assert refund_txs.count() == 1


def test_cancel_order_without_redemption_does_nothing():
    """Si la orden no tiene canje, no lanza error y no toca el balance."""
    account, order, _, _ = _setup()
    initial_points = account.current_points

    cancelled_status = OrderStatusFactory(code="cancelled3", name="Cancelado3")
    order.status = cancelled_status
    order.save(update_fields=["status"])

    revert_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == initial_points
