"""
Tests for the soft-cap logic on loyalty points.

Covers:
- assign_points_for_order with room to spare, partial room, exact fill, already at cap
- No cap configured (max_customer_points_balance=None)
- lifetime_points only increments by what was actually awarded
- revert_points_for_order on a capped transaction
- _eligible_total_amount excludes order items covered by an applied LoyaltyRedemption
- RestaurantLoyaltySettingSerializer validation (active without cap, lowering cap below
  top customer, lowering cap above top customer)
- Idempotence when the existing TX code is earned_purchase_capped
"""

from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

import pytest

from apps.customers.models import PaymentMethodType
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyRedemptionStatus
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import LoyaltyTransactionType
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.loyalty.services import assign_points_for_order
from apps.loyalty.services import revert_points_for_order
from apps.menu.models import MenuItemLoyaltyConfig
from apps.orders.models import Order
from apps.orders.models import OrderItem
from apps.orders.models import OrderPaymentTransaction
from apps.orders.models import PaymentStatus
from apps.restaurants.tests.factories import (
    MenuCategoryFactory,
    MenuItemFactory,
    OrderStatusFactory,
    OrderTypeFactory,
    RestaurantFactory,
)
from apps.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ORDER_COUNTER = 0


def _next_order_code() -> str:
    global _ORDER_COUNTER
    _ORDER_COUNTER += 1
    return f"SC-{_ORDER_COUNTER:05d}"


def _make_loyalty_setting(
    restaurant,
    *,
    is_active: bool = True,
    currency_unit_amount: str = "1000.00",
    points_earned: int = 1,
    max_customer_points_balance: int | None = None,
    max_points_per_order: int | None = None,
) -> RestaurantLoyaltySetting:
    return RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=is_active,
        currency_unit_amount=currency_unit_amount,
        points_earned=points_earned,
        max_customer_points_balance=max_customer_points_balance,
        max_points_per_order=max_points_per_order,
    )


def _make_base_tier(restaurant) -> LoyaltyTier:
    return LoyaltyTier.objects.create(
        code="base", name="Base", min_points=0, restaurant=restaurant
    )


def _make_account(
    user, restaurant, tier, *, current_points: int = 0, lifetime_points: int = 0
) -> LoyaltyAccount:
    return LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=current_points,
        lifetime_points=lifetime_points,
    )


def _build_order(
    user,
    restaurant,
    *,
    total: str = "10000.00",
    make_item_earn: bool = True,
) -> tuple[Order, object]:
    """Create a paid order with one menu item that earns points."""
    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    status = OrderStatusFactory(code="new", name="Nuevo")
    category = MenuCategoryFactory(restaurant=restaurant)
    menu_item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        price_amount=total,
    )
    order = Order.objects.create(
        order_code=_next_order_code(),
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount=total,
        total_amount=total,
    )
    order_item = OrderItem.objects.create(
        order=order,
        menu_item=menu_item,
        item_name_snapshot=menu_item.name,
        unit_price_amount=total,
        quantity=1,
        line_total_amount=total,
    )
    paid_status, _ = PaymentStatus.objects.get_or_create(
        code="completed", defaults={"name": "Completado"}
    )
    payment_method_type, _ = PaymentMethodType.objects.get_or_create(
        code="cash", defaults={"name": "Efectivo"}
    )
    OrderPaymentTransaction.objects.create(
        order=order,
        payment_method_type=payment_method_type,
        payment_status=paid_status,
        amount=total,
    )
    if make_item_earn:
        MenuItemLoyaltyConfig.objects.create(
            menu_item=menu_item,
            earns_points=True,
            allows_points_redemption=True,
        )
    return order, order_item


def _patch_notify():
    """Return a context-manager that silences realtime.notify_user."""
    return patch("apps.loyalty.services.realtime.notify_user")


# ---------------------------------------------------------------------------
# Case 1 — Enough room: max=1000, current=500, purchase gives 100 pts
# ---------------------------------------------------------------------------

def test_soft_cap_room_sufficient_no_cap_applied():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # currency_unit_amount=1000, points_earned=1 → 10000/1000*1 = 10 pts
    # We use 100000 so 100 pts are awarded
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=500, lifetime_points=500)

    order, _item = _build_order(user, restaurant, total="100000.00")

    with _patch_notify():
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 600
    assert account.lifetime_points == 600

    tx = LoyaltyTransaction.objects.get(order=order)
    assert tx.tx_type.code == "earned_purchase"
    assert tx.cap_applied is False
    assert tx.points_uncapped is None


# ---------------------------------------------------------------------------
# Case 2 — Partial room: max=1000, current=998, purchase gives 10 pts → capped at 2
# ---------------------------------------------------------------------------

def test_soft_cap_partial_room_creates_capped_tx():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # 10000/1000*1 = 10 pts uncapped
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=998, lifetime_points=998)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify() as mock_notify:
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 1000
    assert account.lifetime_points == 1000

    tx = LoyaltyTransaction.objects.get(order=order)
    assert tx.tx_type.code == "earned_purchase_capped"
    assert tx.cap_applied is True
    assert tx.points_uncapped == 10
    assert tx.points_delta == 2

    # Both loyalty.points_earned (signal) and loyalty.cap_reached (service) must fire
    called_event_types = [call.kwargs["event_type"] for call in mock_notify.call_args_list]
    assert "loyalty.cap_reached" in called_event_types


# ---------------------------------------------------------------------------
# Case 3 — Exact fill: max=1000, current=990, purchase gives exactly 10 pts
# ---------------------------------------------------------------------------

def test_soft_cap_exact_fill_no_cap_applied():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=990, lifetime_points=990)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify():
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 1000
    assert account.lifetime_points == 1000

    tx = LoyaltyTransaction.objects.get(order=order)
    # Exactly at cap → points_to_assign == points_uncapped, no cap_applied
    assert tx.tx_type.code == "earned_purchase"
    assert tx.cap_applied is False


# ---------------------------------------------------------------------------
# Case 4 — Customer already at cap: no transaction created
# ---------------------------------------------------------------------------

def test_soft_cap_already_at_cap_no_tx_created():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=1000, lifetime_points=1000)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify() as mock_notify:
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 1000  # unchanged

    assert LoyaltyTransaction.objects.filter(order=order).count() == 0

    # Notification must fire to inform customer they are at cap
    mock_notify.assert_called_once()


# ---------------------------------------------------------------------------
# Case 5 — No cap set: points assigned without restriction
# ---------------------------------------------------------------------------

def test_soft_cap_none_assigns_uncapped():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # No max_customer_points_balance
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=None,
    )
    account = _make_account(user, restaurant, tier, current_points=9999, lifetime_points=9999)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify():
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 10009
    assert account.lifetime_points == 10009

    tx = LoyaltyTransaction.objects.get(order=order)
    assert tx.tx_type.code == "earned_purchase"
    assert tx.cap_applied is False


# ---------------------------------------------------------------------------
# Case 6 — lifetime_points only increases by actually awarded delta
# ---------------------------------------------------------------------------

def test_soft_cap_lifetime_points_tracks_awarded_not_uncapped():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # 10 pts uncapped, only 3 will fit
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=997, lifetime_points=500)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify():
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 1000
    assert account.lifetime_points == 503  # 500 + 3 awarded, NOT 500 + 10


# ---------------------------------------------------------------------------
# Case 7 — Revert capped order reverts only what was actually awarded
# ---------------------------------------------------------------------------

def test_revert_points_for_capped_order_reverts_awarded_delta():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=995, lifetime_points=995)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify():
        assign_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 1000  # 995 + 5 awarded

    revert_points_for_order(order)

    account.refresh_from_db()
    assert account.current_points == 995   # back to original
    assert account.lifetime_points == 995

    # Should have 2 transactions: capped earn + reverted
    tx_codes = list(
        LoyaltyTransaction.objects.filter(order=order)
        .values_list("tx_type__code", flat=True)
        .order_by("created_at")
    )
    assert "earned_purchase_capped" in tx_codes
    assert "earned_purchase_reverted" in tx_codes


# ---------------------------------------------------------------------------
# Case 8 — _eligible_total_amount excludes order_item with applied redemption
# ---------------------------------------------------------------------------

def test_eligible_total_excludes_redeemed_order_item():
    """
    Two items in the order. One has an applied LoyaltyRedemption with order_item FK set.
    Only the other item should be counted for point assignment.
    """
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # 1 pt per 1000 COP, cap=None so we can see exact counts
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=None,
    )

    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    status = OrderStatusFactory(code="new", name="Nuevo")
    category = MenuCategoryFactory(restaurant=restaurant)

    item_a = MenuItemFactory(restaurant=restaurant, menu_category=category, price_amount="5000.00")
    item_b = MenuItemFactory(restaurant=restaurant, menu_category=category, price_amount="3000.00")

    order = Order.objects.create(
        order_code=_next_order_code(),
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount="8000.00",
        total_amount="8000.00",
    )
    order_item_a = OrderItem.objects.create(
        order=order,
        menu_item=item_a,
        item_name_snapshot=item_a.name,
        unit_price_amount="5000.00",
        quantity=1,
        line_total_amount="5000.00",
    )
    order_item_b = OrderItem.objects.create(
        order=order,
        menu_item=item_b,
        item_name_snapshot=item_b.name,
        unit_price_amount="3000.00",
        quantity=1,
        line_total_amount="3000.00",
    )

    paid_status, _ = PaymentStatus.objects.get_or_create(
        code="completed", defaults={"name": "Completado"}
    )
    pmt, _ = PaymentMethodType.objects.get_or_create(
        code="cash", defaults={"name": "Efectivo"}
    )
    OrderPaymentTransaction.objects.create(
        order=order,
        payment_method_type=pmt,
        payment_status=paid_status,
        amount="8000.00",
    )

    # Both items earn points
    MenuItemLoyaltyConfig.objects.create(menu_item=item_a, earns_points=True, allows_points_redemption=True)
    MenuItemLoyaltyConfig.objects.create(menu_item=item_b, earns_points=True, allows_points_redemption=True)

    # item_a is covered by an applied redemption with the order_item FK
    tx_type_redeem, _ = LoyaltyTransactionType.objects.get_or_create(
        code="reward_redeemed", defaults={"name": "Recompensa canjeada"}
    )
    applied_status, _ = LoyaltyRedemptionStatus.objects.get_or_create(
        code="applied", defaults={"name": "Aplicado"}
    )
    from apps.loyalty.models import LoyaltyReward
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant, name="Descuento item A", points_cost=50, is_active=True
    )
    acct = _make_account(user, restaurant, tier, current_points=100, lifetime_points=100)
    redeem_tx = LoyaltyTransaction.objects.create(
        loyalty_account=acct,
        tx_type=tx_type_redeem,
        points_delta=-50,
        description="Canje",
    )
    LoyaltyRedemption.objects.create(
        loyalty_transaction=redeem_tx,
        loyalty_reward=reward,
        status=applied_status,
        order=order,
        order_item=order_item_a,   # item_a is redeemed
        points_applied=50,
    )

    with _patch_notify():
        assign_points_for_order(order)

    account = LoyaltyAccount.objects.get(user=user, restaurant=restaurant)
    # Only item_b (3000 COP) should earn: floor(3000/1000)*1 = 3 pts
    # item_a (5000 COP) is excluded due to the applied redemption
    # Initial current_points = 100 → 100 + 3 = 103
    assert account.current_points == 103

    tx = LoyaltyTransaction.objects.filter(
        order=order,
        tx_type__code__in=["earned_purchase", "earned_purchase_capped"],
    ).first()
    assert tx is not None
    assert tx.points_delta == 3


# ---------------------------------------------------------------------------
# Case 9 — Order fully redeemed: _eligible_total_amount returns 0, no pts
# ---------------------------------------------------------------------------

def test_eligible_total_zero_when_all_items_redeemed():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=None,
    )

    order_type = OrderTypeFactory(code="delivery", name="Delivery")
    status = OrderStatusFactory(code="new", name="Nuevo")
    category = MenuCategoryFactory(restaurant=restaurant)
    menu_item = MenuItemFactory(
        restaurant=restaurant, menu_category=category, price_amount="10000.00"
    )
    order = Order.objects.create(
        order_code=_next_order_code(),
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount="10000.00",
        total_amount="10000.00",
    )
    order_item = OrderItem.objects.create(
        order=order,
        menu_item=menu_item,
        item_name_snapshot=menu_item.name,
        unit_price_amount="10000.00",
        quantity=1,
        line_total_amount="10000.00",
    )
    paid_status, _ = PaymentStatus.objects.get_or_create(
        code="completed", defaults={"name": "Completado"}
    )
    pmt, _ = PaymentMethodType.objects.get_or_create(
        code="cash", defaults={"name": "Efectivo"}
    )
    OrderPaymentTransaction.objects.create(
        order=order,
        payment_method_type=pmt,
        payment_status=paid_status,
        amount="10000.00",
    )
    MenuItemLoyaltyConfig.objects.create(menu_item=menu_item, earns_points=True, allows_points_redemption=True)

    # Full redemption applied on the single item
    tx_type_redeem, _ = LoyaltyTransactionType.objects.get_or_create(
        code="reward_redeemed", defaults={"name": "Recompensa canjeada"}
    )
    applied_status, _ = LoyaltyRedemptionStatus.objects.get_or_create(
        code="applied", defaults={"name": "Aplicado"}
    )
    from apps.loyalty.models import LoyaltyReward
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant, name="Gratis", points_cost=100, is_active=True
    )
    acct = _make_account(user, restaurant, tier, current_points=200, lifetime_points=200)
    redeem_tx = LoyaltyTransaction.objects.create(
        loyalty_account=acct,
        tx_type=tx_type_redeem,
        points_delta=-100,
        description="Canje completo",
    )
    LoyaltyRedemption.objects.create(
        loyalty_transaction=redeem_tx,
        loyalty_reward=reward,
        status=applied_status,
        order=order,
        order_item=order_item,
        points_applied=100,
    )

    with _patch_notify():
        assign_points_for_order(order)

    # No earning transaction should be created
    earn_txs = LoyaltyTransaction.objects.filter(
        order=order,
        tx_type__code__in=["earned_purchase", "earned_purchase_capped"],
    )
    assert earn_txs.count() == 0

    acct.refresh_from_db()
    assert acct.current_points == 200  # unchanged


# ---------------------------------------------------------------------------
# Case 10 — Serializer: active=True without max_customer_points_balance → error
# ---------------------------------------------------------------------------

def test_serializer_active_without_cap_raises_validation_error():
    from apps.loyalty.api.serializers import RestaurantLoyaltySettingSerializer

    restaurant = RestaurantFactory()
    data = {
        "restaurant": str(restaurant.id),
        "is_active": True,
        "max_customer_points_balance": None,
        "currency_unit_amount": "1000.00",
        "points_earned": 1,
        "max_redeemable_points_per_order": None,
        "max_points_per_order": None,
        "vip_threshold_orders": 100,
        "point_redeem_value": None,
    }
    serializer = RestaurantLoyaltySettingSerializer(data=data)
    assert not serializer.is_valid()
    assert "max_customer_points_balance" in serializer.errors


# ---------------------------------------------------------------------------
# Case 11 — Serializer: lowering cap below top customer → error
# ---------------------------------------------------------------------------

def test_serializer_lower_cap_below_top_customer_raises_error():
    from apps.loyalty.api.serializers import RestaurantLoyaltySettingSerializer

    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # Customer with 800 pts
    user = UserFactory()
    _make_account(user, restaurant, tier, current_points=800, lifetime_points=800)

    setting = RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )

    # Try to lower cap to 700 (below the customer with 800)
    data = {
        "restaurant": str(restaurant.id),
        "is_active": True,
        "max_customer_points_balance": 700,
        "currency_unit_amount": "1000.00",
        "points_earned": 1,
        "max_redeemable_points_per_order": None,
        "max_points_per_order": None,
        "vip_threshold_orders": 100,
        "point_redeem_value": None,
    }
    serializer = RestaurantLoyaltySettingSerializer(instance=setting, data=data)
    assert not serializer.is_valid()
    assert "max_customer_points_balance" in serializer.errors


# ---------------------------------------------------------------------------
# Case 12 — Serializer: lowering cap above top customer → OK
# ---------------------------------------------------------------------------

def test_serializer_lower_cap_above_top_customer_is_valid():
    from apps.loyalty.api.serializers import RestaurantLoyaltySettingSerializer

    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    # Top customer has 500 pts
    user = UserFactory()
    _make_account(user, restaurant, tier, current_points=500, lifetime_points=500)

    setting = RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )

    # Lower to 600 (above the top customer at 500) → should be valid
    data = {
        "restaurant": str(restaurant.id),
        "is_active": True,
        "max_customer_points_balance": 600,
        "currency_unit_amount": "1000.00",
        "points_earned": 1,
        "max_redeemable_points_per_order": None,
        "max_points_per_order": None,
        "vip_threshold_orders": 100,
        "point_redeem_value": None,
    }
    serializer = RestaurantLoyaltySettingSerializer(instance=setting, data=data)
    assert serializer.is_valid(), serializer.errors


# ---------------------------------------------------------------------------
# Case 13 — Idempotence with earned_purchase_capped
# ---------------------------------------------------------------------------

def test_assign_points_idempotent_when_existing_tx_is_capped():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = _make_base_tier(restaurant)
    _make_loyalty_setting(
        restaurant,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_customer_points_balance=1000,
    )
    account = _make_account(user, restaurant, tier, current_points=995, lifetime_points=995)

    order, _item = _build_order(user, restaurant, total="10000.00")

    with _patch_notify():
        assign_points_for_order(order)   # first call → capped TX created
        assign_points_for_order(order)   # second call → must be a no-op

    account.refresh_from_db()
    assert account.current_points == 1000  # 995 + 5

    earn_txs = LoyaltyTransaction.objects.filter(
        order=order,
        tx_type__code__in=["earned_purchase", "earned_purchase_capped"],
    )
    assert earn_txs.count() == 1, "Segunda llamada no debe crear transaccion duplicada"
