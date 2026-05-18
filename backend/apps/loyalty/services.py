from decimal import Decimal
from decimal import ROUND_FLOOR

from django.db import transaction
from django.utils import timezone

from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyRedemption
from apps.loyalty.models import LoyaltyRedemptionStatus
from apps.loyalty.models import LoyaltyReward
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import LoyaltyTransactionType
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.menu.models import MenuItemLoyaltyConfig
from apps.orders.constants import PAID_PAYMENT_STATUS_CODES
from apps.orders.models import Order


def _quantize_floor(value: Decimal) -> int:
    return int(value.to_integral_value(rounding=ROUND_FLOOR))


def _has_paid_transaction(order: Order) -> bool:
    if not order.payment_transactions.exists():
        return True
    return order.payment_transactions.filter(
        payment_status__code__in=PAID_PAYMENT_STATUS_CODES,
    ).exists()


def _eligible_total_amount(order: Order) -> Decimal:
    order_items = list(order.items.select_related("menu_item"))
    menu_item_ids = [
        order_item.menu_item_id
        for order_item in order_items
        if order_item.menu_item_id is not None
    ]
    if not menu_item_ids:
        return Decimal("0.00")

    loyalty_configs = {
        str(config.menu_item_id): config
        for config in MenuItemLoyaltyConfig.objects.filter(menu_item_id__in=menu_item_ids)
    }

    eligible_total = Decimal("0.00")
    for order_item in order_items:
        if order_item.menu_item_id is None:
            continue
        config = loyalty_configs.get(str(order_item.menu_item_id))
        if config is None or config.allows_points_redemption:
            eligible_total += Decimal(order_item.line_total_amount)
    return eligible_total


def get_tier_for(restaurant, lifetime_points: int) -> LoyaltyTier:
    tier = (
        LoyaltyTier.objects.filter(
            restaurant=restaurant,
            min_points__lte=lifetime_points,
            is_active=True,
        )
        .order_by("-min_points")
        .first()
    )
    if tier:
        return tier

    tier = (
        LoyaltyTier.objects.filter(
            restaurant__isnull=True,
            min_points__lte=lifetime_points,
            is_active=True,
        )
        .order_by("-min_points")
        .first()
    )
    if tier:
        return tier

    return LoyaltyTier.objects.create(
        name="Base",
        code="base",
        min_points=0,
        restaurant=restaurant,
    )


@transaction.atomic
def assign_points_for_order(order: Order) -> None:
    if not order.user:
        return

    if not _has_paid_transaction(order):
        return

    try:
        loyalty_setting = order.restaurant.loyalty_setting
    except RestaurantLoyaltySetting.DoesNotExist:
        return

    currency_unit_amount = Decimal(loyalty_setting.currency_unit_amount)
    if not loyalty_setting.is_active or currency_unit_amount <= Decimal("0"):
        return

    tx_type, _ = LoyaltyTransactionType.objects.get_or_create(
        code="earned_purchase",
        defaults={
            "name": "Puntos ganados por compra",
            "description": "Puntos obtenidos automaticamente por un pedido.",
        },
    )
    if LoyaltyTransaction.objects.filter(order=order, tx_type=tx_type).exists():
        return

    total_amount = _eligible_total_amount(order)
    if total_amount <= 0:
        return
    units_spent = _quantize_floor(total_amount / currency_unit_amount)
    points_to_assign = units_spent * loyalty_setting.points_earned
    if loyalty_setting.max_points_per_order is not None:
        points_to_assign = min(points_to_assign, loyalty_setting.max_points_per_order)
    if points_to_assign <= 0:
        return

    base_tier = get_tier_for(order.restaurant, 0)
    loyalty_account, _ = LoyaltyAccount.objects.get_or_create(
        user=order.user,
        restaurant=order.restaurant,
        defaults={"tier": base_tier},
    )

    LoyaltyTransaction.objects.create(
        loyalty_account=loyalty_account,
        order=order,
        tx_type=tx_type,
        points_delta=points_to_assign,
        description=f"Pedido completado: {order.order_code}",
    )

    loyalty_account.current_points += points_to_assign
    loyalty_account.lifetime_points += points_to_assign
    loyalty_account.tier = get_tier_for(
        loyalty_account.restaurant,
        loyalty_account.lifetime_points,
    )
    loyalty_account.save(update_fields=["current_points", "lifetime_points", "tier", "updated_at"])


@transaction.atomic
def revert_points_for_order(order: Order) -> None:
    if not order.user:
        return

    earned_type = LoyaltyTransactionType.objects.filter(code="earned_purchase").first()
    if not earned_type:
        return

    earned_tx = LoyaltyTransaction.objects.filter(order=order, tx_type=earned_type).first()
    if not earned_tx:
        return

    reverted_type, _ = LoyaltyTransactionType.objects.get_or_create(
        code="earned_purchase_reverted",
        defaults={
            "name": "Puntos revertidos por cancelacion",
            "description": "Reversion automatica de puntos por orden cancelada.",
        },
    )
    if LoyaltyTransaction.objects.filter(order=order, tx_type=reverted_type).exists():
        return

    points_to_revert = abs(earned_tx.points_delta)
    loyalty_account = earned_tx.loyalty_account

    LoyaltyTransaction.objects.create(
        loyalty_account=loyalty_account,
        order=order,
        tx_type=reverted_type,
        points_delta=-points_to_revert,
        description=f"Reversion por cancelacion: {order.order_code}",
    )

    loyalty_account.current_points = max(loyalty_account.current_points - points_to_revert, 0)
    loyalty_account.lifetime_points = max(loyalty_account.lifetime_points - points_to_revert, 0)
    loyalty_account.tier = get_tier_for(
        loyalty_account.restaurant,
        loyalty_account.lifetime_points,
    )
    loyalty_account.save(update_fields=["current_points", "lifetime_points", "tier", "updated_at"])


@transaction.atomic
def redeem_reward(user, reward: LoyaltyReward, points: int | None = None) -> LoyaltyRedemption:
    if not reward.is_active:
        raise ValueError("La recompensa no esta activa.")
    if reward.valid_until and reward.valid_until < timezone.localdate():
        raise ValueError("La recompensa expiro.")
    if reward.available_quantity is not None and reward.available_quantity <= 0:
        raise ValueError("La recompensa no tiene cupos disponibles.")

    loyalty_account = LoyaltyAccount.objects.filter(
        user=user,
        restaurant=reward.restaurant,
    ).first()
    if not loyalty_account:
        raise ValueError("No tienes una cuenta de puntos para este restaurante.")

    points_to_redeem = points or reward.points_cost
    if points_to_redeem <= 0:
        raise ValueError("Debes canjear al menos 1 punto.")
    if loyalty_account.current_points < points_to_redeem:
        raise ValueError("No tienes puntos suficientes para canjear esta recompensa.")

    if reward.max_per_user is not None:
        redemptions_count = LoyaltyRedemption.objects.filter(
            loyalty_reward=reward,
            loyalty_transaction__loyalty_account=loyalty_account,
        ).count()
        if redemptions_count >= reward.max_per_user:
            raise ValueError("Alcanzaste el maximo de canjes para esta recompensa.")

    tx_type, _ = LoyaltyTransactionType.objects.get_or_create(
        code="reward_redeemed",
        defaults={
            "name": "Recompensa canjeada",
            "description": "Canje manual de puntos por una recompensa.",
        },
    )
    pending_status, _ = LoyaltyRedemptionStatus.objects.get_or_create(
        code="pending",
        defaults={"name": "Pendiente", "description": "Canje pendiente de aplicacion."},
    )

    loyalty_transaction = LoyaltyTransaction.objects.create(
        loyalty_account=loyalty_account,
        tx_type=tx_type,
        points_delta=-points_to_redeem,
        description=f"Canje de recompensa: {reward.name}",
    )
    redemption = LoyaltyRedemption.objects.create(
        loyalty_transaction=loyalty_transaction,
        loyalty_reward=reward,
        status=pending_status,
        points_applied=0,
    )

    loyalty_account.current_points = max(loyalty_account.current_points - points_to_redeem, 0)
    loyalty_account.save(update_fields=["current_points", "updated_at"])

    if reward.available_quantity is not None:
        reward.available_quantity -= 1
        reward.save(update_fields=["available_quantity", "updated_at"])

    return redemption


@transaction.atomic
def apply_redemption_to_order(
    order: Order,
    redemption: LoyaltyRedemption,
    line_overrides: list[dict] | None = None,
) -> Decimal:
    if redemption.loyalty_transaction.loyalty_account.user_id != order.user_id:
        raise ValueError("El canje no pertenece al usuario del pedido.")
    if redemption.loyalty_reward.restaurant_id != order.restaurant_id:
        raise ValueError("El canje no pertenece al restaurante del pedido.")

    pending_code = redemption.status.code
    if pending_code != "pending":
        raise ValueError("El canje no esta disponible para aplicar.")

    try:
        loyalty_setting = order.restaurant.loyalty_setting
    except RestaurantLoyaltySetting.DoesNotExist as exc:
        raise ValueError("El restaurante no tiene configuracion de lealtad.") from exc

    point_redeem_value = (
        Decimal(loyalty_setting.point_redeem_value)
        if loyalty_setting.point_redeem_value is not None
        else None
    )
    if point_redeem_value is None or point_redeem_value <= Decimal("0"):
        raise ValueError("El restaurante no configuro la equivalencia de canje por punto.")

    requested_points = abs(redemption.loyalty_transaction.points_delta)
    if not line_overrides:
        line_overrides = []

    if line_overrides:
        points_to_apply = 0
        for line in line_overrides:
            item_index = int(line.get("order_item_index", -1))
            points_for_item = int(line.get("points_to_apply", 0))
            if points_for_item <= 0:
                continue
            if item_index < 0:
                raise ValueError("Indice de item invalido para aplicar canje.")

            try:
                order_item = order.items.all()[item_index]
            except IndexError as exc:
                raise ValueError("Indice de item fuera de rango para aplicar canje.") from exc

            config = MenuItemLoyaltyConfig.objects.filter(menu_item=order_item.menu_item).first()
            if not config or not config.allows_points_redemption:
                raise ValueError(f"El producto '{order_item.item_name_snapshot}' no admite canje.")
            if points_for_item < config.min_points_redeemable:
                raise ValueError(
                    f"Debes aplicar al menos {config.min_points_redeemable} puntos en '{order_item.item_name_snapshot}'.",
                )
            if config.max_points_redeemable is not None and points_for_item > config.max_points_redeemable:
                raise ValueError(
                    f"Superaste el maximo de {config.max_points_redeemable} puntos en '{order_item.item_name_snapshot}'.",
                )
            points_to_apply += points_for_item
    else:
        points_to_apply = requested_points

    if loyalty_setting.max_redeemable_points_per_order is not None:
        points_to_apply = min(points_to_apply, loyalty_setting.max_redeemable_points_per_order)
    points_to_apply = min(points_to_apply, requested_points)
    if points_to_apply <= 0:
        return Decimal("0.00")

    applied_status, _ = LoyaltyRedemptionStatus.objects.get_or_create(
        code="applied",
        defaults={"name": "Aplicado", "description": "Canje aplicado a una orden."},
    )

    redemption.order = order
    redemption.status = applied_status
    redemption.points_applied = points_to_apply
    redemption.save(update_fields=["order", "status", "points_applied", "updated_at"])

    return (Decimal(points_to_apply) * point_redeem_value).quantize(
        Decimal("0.01"),
    )
