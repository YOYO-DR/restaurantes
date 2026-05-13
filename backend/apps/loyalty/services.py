from decimal import Decimal

from django.db import transaction

from apps.loyalty.models import LoyaltyAccount
from apps.loyalty.models import LoyaltyTier
from apps.loyalty.models import LoyaltyTransaction
from apps.loyalty.models import LoyaltyTransactionType
from apps.loyalty.models import RestaurantLoyaltySetting
from apps.orders.models import Order


@transaction.atomic
def assign_points_for_order(order: Order) -> None:
    if not order.user:
        return

    # Intentar obtener la configuración de lealtad del restaurante
    try:
        loyalty_setting = order.restaurant.loyalty_setting
    except RestaurantLoyaltySetting.DoesNotExist:
        return

    if not loyalty_setting.is_active or loyalty_setting.currency_unit_amount <= 0:
        return

    # Calcular puntos basados en el monto total del pedido (segun formula configurada)
    total_amount = Decimal(order.total_amount)
    units_spent = int(total_amount / loyalty_setting.currency_unit_amount)
    points_to_assign = units_spent * loyalty_setting.points_earned

    if points_to_assign <= 0:
        return

    # Asegurar que exista un Tier básico si no hay ninguno
    base_tier = LoyaltyTier.objects.order_by("min_points").first()
    if not base_tier:
        base_tier = LoyaltyTier.objects.create(
            name="Base",
            code="base",
            min_points=0,
        )

    # Obtener o crear la cuenta de lealtad para este usuario y restaurante
    loyalty_account, _ = LoyaltyAccount.objects.get_or_create(
        user=order.user,
        restaurant=order.restaurant,
        defaults={"tier": base_tier},
    )

    # Obtener o crear el tipo de transacción para "Puntos por compra"
    tx_type, _ = LoyaltyTransactionType.objects.get_or_create(
        code="earned_purchase",
        defaults={"name": "Puntos ganados por compra", "description": "Puntos obtenidos automáticamente por un pedido."},
    )

    # Crear la transacción
    LoyaltyTransaction.objects.create(
        loyalty_account=loyalty_account,
        order=order,
        tx_type=tx_type,
        points_delta=points_to_assign,
        description=f"Pedido completado: {order.order_code}",
    )

    # Actualizar saldos
    loyalty_account.current_points += points_to_assign
    loyalty_account.lifetime_points += points_to_assign

    # Evaluar si califica para subir de nivel (Tier)
    # (Opcional, pero asumiendo que los tiers se basan en lifetime_points)
    better_tier = LoyaltyTier.objects.filter(
        min_points__lte=loyalty_account.lifetime_points,
    ).order_by("-min_points").first()

    if better_tier and better_tier.id != loyalty_account.tier_id:
        loyalty_account.tier = better_tier

    loyalty_account.save()
