from rest_framework.routers import SimpleRouter

from apps.billing.api.owner_views import OwnerAvailablePlansViewSet
from apps.billing.api.owner_views import OwnerPlanChangeRequestViewSet
from apps.billing.api.owner_views import OwnerSubscriptionViewSet

router = SimpleRouter()
router.register("owner/billing/subscription", OwnerSubscriptionViewSet, basename="owner-billing-subscription")
router.register("owner/billing/plans", OwnerAvailablePlansViewSet, basename="owner-billing-plans")
router.register(
    "owner/billing/plan-change-requests",
    OwnerPlanChangeRequestViewSet,
    basename="owner-billing-change-request",
)

urlpatterns = router.urls
