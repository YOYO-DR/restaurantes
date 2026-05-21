import pytest
from django.core.exceptions import ValidationError

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import PlanChangeRequest
from apps.billing.services.requests import approve_request
from apps.billing.services.requests import create_change_request
from apps.billing.services.requests import reject_request
from apps.billing.services.subscriptions import start_trial
from apps.billing.tests.factories import PlanFactory
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


def _setup_restaurant_with_owner():
    owner = UserFactory()
    restaurant = RestaurantFactory(owner=owner)
    return restaurant, owner


@pytest.mark.django_db
class TestCreateChangeRequest:
    def test_creates_pending_request(self):
        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)

        pro = PlanFactory(code="pro-req", name="Pro Req", price_amount="50000.00")
        req = create_change_request(restaurant, pro, owner)

        assert req.status == PlanChangeRequest.STATUS_PENDING
        assert req.requested_plan == pro
        assert req.restaurant == restaurant

    def test_rejects_same_plan(self):
        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        from apps.billing.services.subscriptions import get_active_subscription
        sub = get_active_subscription(restaurant)
        current_plan = sub.plan

        with pytest.raises(ValidationError, match="mismo"):
            create_change_request(restaurant, current_plan, owner)

    def test_rejects_duplicate_pending(self):
        from rest_framework.exceptions import ValidationError as DRFValidationError

        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-dup", name="Pro Dup", price_amount="50000.00")
        create_change_request(restaurant, pro, owner)

        with pytest.raises(DRFValidationError):
            create_change_request(restaurant, pro, owner)

    def test_rejects_non_owner(self):
        from rest_framework.exceptions import PermissionDenied

        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-deny", name="Pro Deny", price_amount="50000.00")
        other_user = UserFactory()

        with pytest.raises(PermissionDenied):
            create_change_request(restaurant, pro, other_user)


@pytest.mark.django_db
class TestApproveRequest:
    def test_activates_plan_and_creates_event(self):
        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-approve", name="Pro Approve", price_amount="50000.00")
        admin = UserFactory()
        req = create_change_request(restaurant, pro, owner)

        approved = approve_request(req, admin, notes="Aprobado")
        assert approved.status == PlanChangeRequest.STATUS_APPROVED
        assert approved.decided_by == admin

        from apps.billing.services.subscriptions import get_active_subscription
        sub = get_active_subscription(restaurant)
        assert sub.plan.pk == pro.pk

    def test_cannot_approve_already_approved(self):
        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-app2", name="Pro App2", price_amount="50000.00")
        admin = UserFactory()
        req = create_change_request(restaurant, pro, owner)
        approve_request(req, admin)

        req.refresh_from_db()
        with pytest.raises(ValidationError):
            approve_request(req, admin)


@pytest.mark.django_db
class TestRejectRequest:
    def test_marks_status_with_notes(self):
        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-reject", name="Pro Reject", price_amount="50000.00")
        admin = UserFactory()
        req = create_change_request(restaurant, pro, owner)

        rejected = reject_request(req, admin, notes="No aplica")
        assert rejected.status == PlanChangeRequest.STATUS_REJECTED
        assert rejected.notes == "No aplica"
        assert rejected.decided_by == admin

    def test_cannot_reject_approved(self):
        ensure_billing_catalogs()
        restaurant, owner = _setup_restaurant_with_owner()
        start_trial(restaurant)
        pro = PlanFactory(code="pro-rej2", name="Pro Rej2", price_amount="50000.00")
        admin = UserFactory()
        req = create_change_request(restaurant, pro, owner)
        approve_request(req, admin)
        req.refresh_from_db()

        with pytest.raises(ValidationError):
            reject_request(req, admin)
