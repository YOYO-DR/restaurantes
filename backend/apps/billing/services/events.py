from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apps.billing.models import Plan
    from apps.restaurants.models import Restaurant
    from apps.users.models import User


def log_event(
    restaurant: Restaurant,
    event_type: str,
    *,
    old_plan: Plan | None = None,
    new_plan: Plan | None = None,
    actor: User | None = None,
    payload: dict | None = None,
) -> None:
    from apps.billing.models import SubscriptionEvent

    valid_types = {code for code, _ in SubscriptionEvent.EVENT_CHOICES}
    if event_type not in valid_types:
        raise ValueError(f"event_type inválido: '{event_type}'. Válidos: {sorted(valid_types)}")

    SubscriptionEvent.objects.create(
        restaurant=restaurant,
        event_type=event_type,
        old_plan=old_plan,
        new_plan=new_plan,
        actor=actor,
        payload=payload or {},
    )
