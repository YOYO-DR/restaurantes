from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from django.db import transaction
from django.utils import timezone

if TYPE_CHECKING:
    from apps.billing.models import Plan
    from apps.restaurants.models import Restaurant
    from apps.users.models import User


def get_active_subscription(restaurant: Restaurant):
    from apps.billing.models import RestaurantSubscription

    try:
        return RestaurantSubscription.objects.select_related("plan").get(restaurant=restaurant)
    except RestaurantSubscription.DoesNotExist:
        return None


def start_trial(restaurant: Restaurant, actor: User | None = None):
    from apps.billing.models import Plan
    from apps.billing.models import RestaurantFeatureOverride
    from apps.billing.models import RestaurantSubscription
    from apps.billing.models import TrialConfig
    from apps.billing.services.events import log_event

    config = TrialConfig.objects.prefetch_related("trial_feature_defaults__feature").first()

    if config is None or not config.is_enabled or config.trial_plan is None:
        return _create_active_on_free(restaurant, actor)

    override_days = getattr(
        RestaurantSubscription.objects.filter(restaurant=restaurant).values_list("override_trial_days", flat=True).first(),
        "__class__",
        None,
    )
    trial_days = config.default_trial_days
    sub, created = RestaurantSubscription.objects.get_or_create(
        restaurant=restaurant,
        defaults={
            "plan": config.trial_plan,
            "status": RestaurantSubscription.STATUS_TRIAL,
            "trial_start": timezone.now(),
            "trial_end": timezone.now() + timedelta(days=trial_days),
        },
    )
    if not created:
        return sub

    for tfd in config.trial_feature_defaults.all():
        RestaurantFeatureOverride.objects.update_or_create(
            restaurant=restaurant,
            feature=tfd.feature,
            defaults={
                "can_view": tfd.can_view,
                "can_create": tfd.can_create,
                "can_edit": tfd.can_edit,
                "can_delete": tfd.can_delete,
                "source": RestaurantFeatureOverride.SOURCE_TRIAL,
            },
        )

    log_event(
        restaurant,
        "trial_started",
        new_plan=config.trial_plan,
        actor=actor,
        payload={"trial_days": trial_days},
    )
    return sub


def _create_active_on_free(restaurant: Restaurant, actor: User | None = None):
    from apps.billing.models import Plan
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.events import log_event

    free_plan = Plan.objects.filter(is_free=True, is_active=True).first()
    if free_plan is None:
        raise ValueError("No existe un plan FREE activo. Ejecuta ensure_billing_catalogs().")

    sub, created = RestaurantSubscription.objects.get_or_create(
        restaurant=restaurant,
        defaults={
            "plan": free_plan,
            "status": RestaurantSubscription.STATUS_ACTIVE,
        },
    )
    if created:
        log_event(restaurant, "plan_changed", new_plan=free_plan, actor=actor)
    return sub


def activate_subscription(restaurant: Restaurant, plan: Plan, actor: User | None = None):
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.events import log_event

    now = timezone.now()
    days = plan.billing_period.days if plan.billing_period and hasattr(plan.billing_period, "days") else 30

    sub = get_active_subscription(restaurant)
    old_plan = sub.plan if sub else None

    if sub is None:
        sub = RestaurantSubscription(restaurant=restaurant)

    sub.plan = plan
    sub.status = RestaurantSubscription.STATUS_ACTIVE
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=days)
    sub.cancelled_at = None
    sub.scheduled_downgrade_to = None
    sub.auto_renew = True
    sub.save()

    log_event(restaurant, "plan_changed", old_plan=old_plan, new_plan=plan, actor=actor)
    return sub


def cancel_subscription(restaurant: Restaurant, actor: User | None = None):
    from apps.billing.models import Plan
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.events import log_event

    sub = get_active_subscription(restaurant)
    if sub is None:
        raise ValueError("El restaurante no tiene suscripción activa.")
    if sub.cancelled_at is not None:
        raise ValueError("La suscripción ya está cancelada.")

    free_plan = Plan.objects.filter(is_free=True, is_active=True).first()
    sub.cancelled_at = timezone.now()
    sub.scheduled_downgrade_to = free_plan
    sub.auto_renew = False
    sub.save()

    log_event(restaurant, "subscription_cancelled", actor=actor)
    return sub


def downgrade_to_free(restaurant: Restaurant, actor: User | None = None):
    from apps.billing.models import Plan
    from apps.billing.models import RestaurantFeatureOverride
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.events import log_event

    free_plan = Plan.objects.filter(is_free=True, is_active=True).first()
    if free_plan is None:
        raise ValueError("No existe un plan FREE activo.")

    sub = get_active_subscription(restaurant)
    if sub is None:
        sub = RestaurantSubscription(restaurant=restaurant)

    old_plan = sub.plan
    sub.plan = free_plan
    sub.status = RestaurantSubscription.STATUS_ACTIVE
    sub.current_period_end = None
    sub.cancelled_at = None
    sub.scheduled_downgrade_to = None
    sub.auto_renew = False
    sub.save()

    RestaurantFeatureOverride.objects.filter(
        restaurant=restaurant,
        source=RestaurantFeatureOverride.SOURCE_TRIAL,
    ).delete()

    log_event(
        restaurant,
        "subscription_downgraded",
        old_plan=old_plan,
        new_plan=free_plan,
        actor=actor,
    )
    return sub


def expire_trial(restaurant: Restaurant):
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.events import log_event

    sub = get_active_subscription(restaurant)
    if sub is None or sub.status != RestaurantSubscription.STATUS_TRIAL:
        return None

    log_event(restaurant, "trial_expired", old_plan=sub.plan)
    return downgrade_to_free(restaurant)
