from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

if TYPE_CHECKING:
    from apps.billing.models import Plan
    from apps.billing.models import PlanChangeRequest
    from apps.restaurants.models import Restaurant
    from apps.users.models import User


def create_change_request(restaurant: Restaurant, requested_plan: Plan, requested_by: User, notes: str = "") -> PlanChangeRequest:
    from rest_framework.exceptions import PermissionDenied

    from apps.billing.models import PlanChangeRequest
    from apps.billing.models import RestaurantSubscription
    from apps.billing.services.events import log_event

    if restaurant.owner_id != requested_by.pk:
        raise PermissionDenied("No eres el propietario de este restaurante.")

    sub = RestaurantSubscription.objects.select_related("plan").get(restaurant=restaurant)
    current_plan = sub.plan

    if current_plan.pk == requested_plan.pk:
        raise ValidationError("El plan solicitado es el mismo que el actual.")

    if PlanChangeRequest.objects.filter(
        restaurant=restaurant,
        status=PlanChangeRequest.STATUS_PENDING,
    ).exists():
        from rest_framework.exceptions import ValidationError as DRFValidationError
        raise DRFValidationError(
            {"detail": "Ya existe una solicitud pendiente para este restaurante."},
            code="conflict",
        )

    request_type = (
        PlanChangeRequest.TYPE_UPGRADE
        if Decimal(str(requested_plan.price_amount)) >= Decimal(str(current_plan.price_amount))
        else PlanChangeRequest.TYPE_DOWNGRADE
    )

    req = PlanChangeRequest.objects.create(
        restaurant=restaurant,
        requested_plan=requested_plan,
        current_plan=current_plan,
        request_type=request_type,
        requested_by=requested_by,
        notes=notes,
        status=PlanChangeRequest.STATUS_PENDING,
    )
    log_event(restaurant, "request_created", old_plan=current_plan, new_plan=requested_plan, actor=requested_by)
    return req


def approve_request(req: PlanChangeRequest, decided_by: User, notes: str = "") -> PlanChangeRequest:
    from apps.billing.models import PlanChangeRequest
    from apps.billing.services.events import log_event
    from apps.billing.services.subscriptions import activate_subscription

    with transaction.atomic():
        req = PlanChangeRequest.objects.select_for_update().get(pk=req.pk)
        if req.status != PlanChangeRequest.STATUS_PENDING:
            raise ValidationError(f"La solicitud ya tiene status '{req.status}', no se puede aprobar.")

        from apps.billing.models import RestaurantSubscription
        RestaurantSubscription.objects.select_for_update().filter(restaurant=req.restaurant).first()

        activate_subscription(req.restaurant, req.requested_plan, actor=decided_by)

        req.status = PlanChangeRequest.STATUS_APPROVED
        req.decided_by = decided_by
        req.decided_at = timezone.now()
        req.notes = notes
        req.save()

    log_event(
        req.restaurant,
        "request_approved",
        old_plan=req.current_plan,
        new_plan=req.requested_plan,
        actor=decided_by,
    )
    return req


def reject_request(req: PlanChangeRequest, decided_by: User, notes: str = "") -> PlanChangeRequest:
    from apps.billing.models import PlanChangeRequest
    from apps.billing.services.events import log_event

    with transaction.atomic():
        req = PlanChangeRequest.objects.select_for_update().get(pk=req.pk)
        if req.status != PlanChangeRequest.STATUS_PENDING:
            raise ValidationError(f"La solicitud ya tiene status '{req.status}', no se puede rechazar.")

        req.status = PlanChangeRequest.STATUS_REJECTED
        req.decided_by = decided_by
        req.decided_at = timezone.now()
        req.notes = notes
        req.save()

    log_event(req.restaurant, "request_rejected", actor=decided_by)
    return req


def supersede_pending_requests(restaurant: Restaurant, actor: User | None = None) -> int:
    from apps.billing.models import PlanChangeRequest

    return PlanChangeRequest.objects.filter(
        restaurant=restaurant,
        status=PlanChangeRequest.STATUS_PENDING,
    ).update(status=PlanChangeRequest.STATUS_SUPERSEDED)
