from django.urls import path

from apps.restaurants.api.views import OwnerInvitationCancelView
from apps.restaurants.api.views import OwnerOperatorDetailView
from apps.restaurants.api.views import OwnerOperatorListView
from apps.restaurants.api.views import OwnerOperatorPermissionsView
from apps.restaurants.api.views import PublicInvitationDetailView

urlpatterns = [
    # Operator management (owner only)
    path(
        "owner/restaurants/<uuid:restaurant_id>/operators/",
        OwnerOperatorListView.as_view(),
        name="owner-operator-list",
    ),
    path(
        "owner/restaurants/<uuid:restaurant_id>/operators/<uuid:operator_id>/",
        OwnerOperatorDetailView.as_view(),
        name="owner-operator-detail",
    ),
    path(
        "owner/restaurants/<uuid:restaurant_id>/operators/<uuid:operator_id>/permissions/",
        OwnerOperatorPermissionsView.as_view(),
        name="owner-operator-permissions",
    ),
    path(
        "owner/restaurants/<uuid:restaurant_id>/invitations/<uuid:invitation_id>/",
        OwnerInvitationCancelView.as_view(),
        name="owner-invitation-cancel",
    ),
    # Public invitation acceptance
    path(
        "invitations/<uuid:token>/",
        PublicInvitationDetailView.as_view(),
        name="invitation-detail",
    ),
]
