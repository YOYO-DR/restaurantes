import pytest

from apps.customers.models import PaymentMethodType
from apps.notifications import realtime
from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.loyalty.services import apply_redemption_to_order
from apps.loyalty.services import assign_points_for_order
from apps.loyalty.services import redeem_reward
from apps.loyalty.services import revert_points_for_order
from apps.menu.models import MenuItemLoyaltyConfig
from apps.orders.models import PaymentStatus
from apps.orders.models import OrderPaymentTransaction
from apps.restaurants.tests.factories import MenuCategoryFactory
from apps.restaurants.tests.factories import MenuItemFactory
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantDeliverySettingFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.restaurants.tests.factories import RestaurantOrderCapabilityFactory
from apps.users.tests.factories import UserFactory


pytestmark = pytest.mark.django_db


def _build_order(user, restaurant, *, order_type_code="delivery", total="20000.00"):
    order_type = OrderTypeFactory(code=order_type_code, name=order_type_code.title())
    status = OrderStatusFactory(code="new", name="Nuevo")
    category = MenuCategoryFactory(restaurant=restaurant)
    item = MenuItemFactory(
        restaurant=restaurant,
        menu_category=category,
        price_amount=total,
    )
    from apps.orders.models import Order
    from apps.orders.models import OrderItem

    order = Order.objects.create(
        order_code=f"ORD-{Order.objects.count() + 1:04d}",
        user=user,
        restaurant=restaurant,
        order_type=order_type,
        status=status,
        subtotal_amount=total,
        total_amount=total,
    )
    OrderItem.objects.create(
        order=order,
        menu_item=item,
        item_name_snapshot=item.name,
        unit_price_amount=total,
        quantity=1,
        line_total_amount=total,
    )
    paid_status, _ = PaymentStatus.objects.get_or_create(
        code="completed",
        defaults={"name": "Completado"},
    )
    payment_method_type, _ = PaymentMethodType.objects.get_or_create(
        code="cash",
        defaults={"name": "Efectivo"},
    )
    OrderPaymentTransaction.objects.create(
        order=order,
        payment_method_type=payment_method_type,
        payment_status=paid_status,
        amount=total,
    )
    return order, item


def test_assign_points_for_order_is_idempotent_and_applies_cap():
    user = UserFactory()
    restaurant = RestaurantFactory()
    RestaurantOrderCapabilityFactory(restaurant=restaurant)
    RestaurantDeliverySettingFactory(restaurant=restaurant)
    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=2,
        max_points_per_order=10,
    )
    order, item = _build_order(user, restaurant, total="12000.00")
    MenuItemLoyaltyConfig.objects.create(
        menu_item=item,
        allows_points_redemption=True,
    )

    assign_points_for_order(order)
    assign_points_for_order(order)

    account = LoyaltyAccount.objects.get(user=user, restaurant=restaurant)
    assert account.current_points == 10
    assert account.lifetime_points == 10
    assert LoyaltyTransaction.objects.filter(order=order).count() == 1


def test_revert_points_for_order_creates_negative_tx():
    user = UserFactory()
    restaurant = RestaurantFactory()
    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )
    order, item = _build_order(user, restaurant, total="3000.00")
    MenuItemLoyaltyConfig.objects.create(
        menu_item=item,
        allows_points_redemption=True,
    )

    assign_points_for_order(order)
    revert_points_for_order(order)

    account = LoyaltyAccount.objects.get(user=user, restaurant=restaurant)
    assert account.current_points == 0
    assert LoyaltyTransaction.objects.filter(order=order).count() == 2


def test_redeem_reward_validates_limits_and_availability():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    account = LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=200,
        lifetime_points=200,
    )
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Postre",
        points_cost=100,
        is_active=True,
        available_quantity=1,
        max_per_user=1,
    )

    redemption = redeem_reward(user, reward)
    account.refresh_from_db()
    reward.refresh_from_db()

    assert isinstance(redemption, LoyaltyRedemption)
    assert account.current_points == 100
    assert reward.available_quantity == 0

    with pytest.raises(ValueError):
        redeem_reward(user, reward)


def test_apply_redemption_to_order_respects_item_constraints():
    user = UserFactory()
    restaurant = RestaurantFactory()
    tier = LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
        max_redeemable_points_per_order=200,
        point_redeem_value="1.00",
    )
    LoyaltyAccount.objects.create(
        user=user,
        restaurant=restaurant,
        tier=tier,
        current_points=300,
        lifetime_points=300,
    )
    reward = LoyaltyReward.objects.create(
        restaurant=restaurant,
        name="Canje 150",
        points_cost=150,
        is_active=True,
    )
    redemption = redeem_reward(user, reward)
    order, menu_item = _build_order(user, restaurant, total="12000.00")
    MenuItemLoyaltyConfig.objects.create(
        menu_item=menu_item,
        allows_points_redemption=True,
        min_points_redeemable=50,
        max_points_redeemable=150,
    )

    discount = apply_redemption_to_order(
        order,
        redemption,
        [{"order_item_index": 0, "points_to_apply": 120}],
    )
    redemption.refresh_from_db()

    assert str(discount) == "120.00"
    assert redemption.points_applied == 120


def test_assign_points_for_order_skips_non_redeemable_items():
    user = UserFactory()
    restaurant = RestaurantFactory()
    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )
    order, item = _build_order(user, restaurant, total="6000.00")
    MenuItemLoyaltyConfig.objects.create(
        menu_item=item,
        allows_points_redemption=False,
    )

    assign_points_for_order(order)

    assert not LoyaltyAccount.objects.filter(user=user, restaurant=restaurant).exists()
    assert LoyaltyTransaction.objects.filter(order=order).count() == 0


def test_assign_points_for_order_counts_items_without_config_as_eligible():
    user = UserFactory()
    restaurant = RestaurantFactory()
    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )
    order, _item = _build_order(user, restaurant, total="6000.00")

    assign_points_for_order(order)

    account = LoyaltyAccount.objects.get(user=user, restaurant=restaurant)
    assert account.current_points == 6
    assert LoyaltyTransaction.objects.filter(order=order).count() == 1


def test_assign_points_for_order_notifies_with_restaurant_and_order_code(monkeypatch):
    notifications = []

    def _fake_notify_user(*, user_id, event_type, payload, persist=True):
        notifications.append(
            {
                "user_id": user_id,
                "event_type": event_type,
                "payload": payload,
            },
        )

    monkeypatch.setattr(realtime, "notify_user", _fake_notify_user)

    user = UserFactory()
    restaurant = RestaurantFactory(display_name="Fogon")
    LoyaltyTier.objects.create(code="base", name="Base", min_points=0, restaurant=restaurant)
    RestaurantLoyaltySetting.objects.create(
        restaurant=restaurant,
        is_active=True,
        currency_unit_amount="1000.00",
        points_earned=1,
    )
    order, _item = _build_order(user, restaurant, total="2000.00")

    assign_points_for_order(order)

    earned = [n for n in notifications if n["event_type"] == "loyalty.points_earned"]
    assert len(earned) == 1
    assert earned[0]["payload"]["restaurant_name"] == "Fogon"
    assert earned[0]["payload"]["order_code"] == order.order_code
