from django.urls import include
from django.urls import path
from rest_framework.routers import SimpleRouter

from apps.billing.api.admin_views import AdminFeaturesViewSet
from apps.billing.api.admin_views import AdminPlanChangeRequestViewSet
from apps.billing.api.admin_views import AdminPlansViewSet
from apps.billing.api.admin_views import AdminRestaurantSubscriptionViewSet
from apps.billing.api.admin_views import AdminSubscriptionEventsViewSet
from apps.billing.api.admin_views import AdminTrialConfigViewSet

router = SimpleRouter()
router.register("admin/billing/features", AdminFeaturesViewSet, basename="admin-billing-feature")
router.register("admin/billing/plans", AdminPlansViewSet, basename="admin-billing-plan")
router.register("admin/billing/trial-config", AdminTrialConfigViewSet, basename="admin-billing-trial-config")
router.register(
    "admin/billing/restaurant-subscriptions",
    AdminRestaurantSubscriptionViewSet,
    basename="admin-billing-subscription",
)
router.register(
    "admin/billing/plan-change-requests",
    AdminPlanChangeRequestViewSet,
    basename="admin-billing-change-request",
)
router.register(
    "admin/billing/subscription-events",
    AdminSubscriptionEventsViewSet,
    basename="admin-billing-event",
)

urlpatterns = router.urls
