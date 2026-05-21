from __future__ import annotations

from collections import deque
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError

if TYPE_CHECKING:
    from apps.billing.models import Feature


def detect_cycle(feature: Feature, depends_on: Feature) -> bool:
    """
    BFS from depends_on following depends_on→feature direction.
    Returns True if adding feature→depends_on would create a cycle.
    """
    from apps.billing.models import FeatureDependency

    visited = set()
    queue = deque([depends_on.pk])
    while queue:
        current_id = queue.popleft()
        if current_id in visited:
            continue
        visited.add(current_id)
        if current_id == feature.pk:
            return True
        for dep in FeatureDependency.objects.filter(feature_id=current_id).values_list("depends_on_id", flat=True):
            if dep not in visited:
                queue.append(dep)
    return False


def validate_dependencies(active_codes: set[str]) -> None:
    """
    Raises ValidationError if any active feature depends on a feature not in active_codes.
    Only considers active features' dependencies.
    """
    from apps.billing.models import Feature
    from apps.billing.models import FeatureDependency

    active_features = Feature.objects.filter(code__in=active_codes, is_active=True)
    active_pks = {f.pk for f in active_features}
    active_code_map = {f.pk: f.code for f in active_features}

    deps = FeatureDependency.objects.filter(
        feature_id__in=active_pks,
        depends_on__is_active=True,
    ).select_related("feature", "depends_on")

    for dep in deps:
        if dep.depends_on_id not in active_pks:
            raise ValidationError(
                f"'{dep.feature.code}' requiere '{dep.depends_on.code}' pero no está en el plan."
            )


def expand_dependencies(active_codes: set[str]) -> set[str]:
    """
    Returns active_codes expanded with all transitive dependencies.
    Useful for auto-include when enabling a feature that requires others.
    Only includes active features.
    """
    from apps.billing.models import Feature
    from apps.billing.models import FeatureDependency

    result = set(active_codes)
    queue = deque(active_codes)

    while queue:
        code = queue.popleft()
        try:
            feature = Feature.objects.get(code=code, is_active=True)
        except Feature.DoesNotExist:
            continue
        dep_codes = list(
            FeatureDependency.objects.filter(feature=feature, depends_on__is_active=True)
            .values_list("depends_on__code", flat=True)
        )
        for dep_code in dep_codes:
            if dep_code not in result:
                result.add(dep_code)
                queue.append(dep_code)

    return result
