from decimal import Decimal

from factory import LazyAttribute
from factory import Sequence
from factory import SubFactory
from factory.django import DjangoModelFactory

from apps.billing.models import Feature
from apps.billing.models import FeatureDependency
from apps.billing.models import Plan
from apps.billing.models import PlanChangeRequest
from apps.billing.models import PlanFeature
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.models import SubscriptionEvent
from apps.billing.models import TrialConfig
from apps.billing.models import TrialFeatureDefault
from apps.restaurants.tests.factories import RestaurantFactory
from apps.users.tests.factories import UserFactory


class FeatureFactory(DjangoModelFactory[Feature]):
    code = Sequence(lambda n: f"feature-{n}")
    name = Sequence(lambda n: f"Feature {n}")
    category = "general"
    is_active = True
    sort_order = Sequence(lambda n: n)

    class Meta:
        model = Feature
        django_get_or_create = ("code",)


class PlanFactory(DjangoModelFactory[Plan]):
    code = Sequence(lambda n: f"plan-{n}")
    name = Sequence(lambda n: f"Plan {n}")
    price_amount = Decimal("0.00")
    currency_code = "COP"
    is_free = False
    is_default = False
    is_active = True
    sort_order = Sequence(lambda n: n)

    class Meta:
        model = Plan
        django_get_or_create = ("code",)


class FreePlanFactory(PlanFactory):
    code = "free"
    name = "Free"
    is_free = True


class PlanFeatureFactory(DjangoModelFactory[PlanFeature]):
    plan = SubFactory(PlanFactory)
    feature = SubFactory(FeatureFactory)
    can_view = True
    can_create = False
    can_edit = False
    can_delete = False

    class Meta:
        model = PlanFeature


class TrialConfigFactory(DjangoModelFactory[TrialConfig]):
    is_enabled = True
    default_trial_days = 14
    trial_plan = SubFactory(PlanFactory)

    class Meta:
        model = TrialConfig


class TrialFeatureDefaultFactory(DjangoModelFactory[TrialFeatureDefault]):
    trial_config = SubFactory(TrialConfigFactory)
    feature = SubFactory(FeatureFactory)
    can_view = True
    can_create = True
    can_edit = True
    can_delete = False

    class Meta:
        model = TrialFeatureDefault


class RestaurantSubscriptionFactory(DjangoModelFactory[RestaurantSubscription]):
    restaurant = SubFactory(RestaurantFactory)
    plan = SubFactory(PlanFactory)
    status = RestaurantSubscription.STATUS_ACTIVE

    class Meta:
        model = RestaurantSubscription


class RestaurantFeatureOverrideFactory(DjangoModelFactory[RestaurantFeatureOverride]):
    restaurant = SubFactory(RestaurantFactory)
    feature = SubFactory(FeatureFactory)
    can_view = True
    can_create = False
    can_edit = False
    can_delete = False
    source = RestaurantFeatureOverride.SOURCE_ADMIN

    class Meta:
        model = RestaurantFeatureOverride


class PlanChangeRequestFactory(DjangoModelFactory[PlanChangeRequest]):
    restaurant = SubFactory(RestaurantFactory)
    requested_plan = SubFactory(PlanFactory)
    current_plan = SubFactory(PlanFactory)
    request_type = PlanChangeRequest.TYPE_UPGRADE
    status = PlanChangeRequest.STATUS_PENDING
    requested_by = SubFactory(UserFactory)

    class Meta:
        model = PlanChangeRequest


class SubscriptionEventFactory(DjangoModelFactory[SubscriptionEvent]):
    restaurant = SubFactory(RestaurantFactory)
    event_type = SubscriptionEvent.EVENT_TRIAL_STARTED
    actor = SubFactory(UserFactory)

    class Meta:
        model = SubscriptionEvent


class FeatureDependencyFactory(DjangoModelFactory[FeatureDependency]):
    feature = SubFactory(FeatureFactory)
    depends_on = SubFactory(FeatureFactory)

    class Meta:
        model = FeatureDependency
