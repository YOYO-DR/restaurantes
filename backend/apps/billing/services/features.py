from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import uuid


def get_effective_features(restaurant_id: uuid.UUID) -> dict[str, dict[str, bool]]:
    """
    Returns {feature_code: {can_view, can_create, can_edit, can_delete}} for the
    restaurant, merging plan features with per-restaurant overrides.
    Overrides take precedence over plan features.
    Inactive features are excluded.
    """
    from apps.billing.models import RestaurantSubscription

    try:
        sub = (
            RestaurantSubscription.objects.select_related("plan")
            .prefetch_related(
                "plan__plan_features__feature",
                "restaurant__feature_overrides__feature",
            )
            .get(restaurant_id=restaurant_id)
        )
    except RestaurantSubscription.DoesNotExist:
        return {}

    result: dict[str, dict[str, bool]] = {}

    for pf in sub.plan.plan_features.all():
        if not pf.feature.is_active:
            continue
        result[pf.feature.code] = {
            "can_view": pf.can_view,
            "can_create": pf.can_create,
            "can_edit": pf.can_edit,
            "can_delete": pf.can_delete,
        }

    for override in sub.restaurant.feature_overrides.all():
        if not override.feature.is_active:
            continue
        result[override.feature.code] = {
            "can_view": override.can_view,
            "can_create": override.can_create,
            "can_edit": override.can_edit,
            "can_delete": override.can_delete,
        }

    return result


def check_feature_access(restaurant_id: uuid.UUID, feature_code: str, action: str) -> bool:
    """
    action: "view" | "create" | "edit" | "delete"
    can_create/edit/delete require can_view to be True.
    """
    features = get_effective_features(restaurant_id)
    feature = features.get(feature_code)
    if feature is None:
        return False
    if not feature["can_view"]:
        return False
    if action == "view":
        return True
    return bool(feature.get(f"can_{action}", False))


def serialize_features_for_jwt(restaurant_id: uuid.UUID) -> dict[str, dict[str, bool]]:
    """Returns the same shape as get_effective_features, suitable for JWT payload."""
    return get_effective_features(restaurant_id)
