from decimal import Decimal

from factory import Faker
from factory import LazyAttribute
from factory import Sequence
from factory.django import DjangoModelFactory

from apps.menu.models import MenuCategory
from apps.menu.models import MenuItem
from apps.orders.models import OrderStatus
from apps.orders.models import OrderType
from apps.platform_config.models import BillingPeriod
from apps.platform_config.models import SubscriptionPlan
from apps.customers.models import AddressType
from apps.customers.models import CustomerAddress
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantAddress
from apps.restaurants.models import RestaurantCategory
from apps.restaurants.models import RestaurantDeliverySetting
from apps.restaurants.models import RestaurantHour
from apps.restaurants.models import RestaurantOrderCapability
from apps.restaurants.models import RestaurantStatus
from apps.users.tests.factories import UserFactory


class BillingPeriodFactory(DjangoModelFactory[BillingPeriod]):
    code = Sequence(lambda n: f"billing-{n}")
    name = Sequence(lambda n: f"Billing {n}")

    class Meta:
        model = BillingPeriod


class SubscriptionPlanFactory(DjangoModelFactory[SubscriptionPlan]):
    billing_period = LazyAttribute(lambda _: BillingPeriodFactory())
    code = Sequence(lambda n: f"plan-{n}")
    name = Sequence(lambda n: f"Plan {n}")
    price_amount = Decimal("0.00")
    currency_code = "COP"

    class Meta:
        model = SubscriptionPlan


class RestaurantStatusFactory(DjangoModelFactory[RestaurantStatus]):
    code = "active"
    name = "Activo"

    class Meta:
        model = RestaurantStatus
        django_get_or_create = ("code",)


class RestaurantCategoryFactory(DjangoModelFactory[RestaurantCategory]):
    code = Sequence(lambda n: f"category-{n}")
    name = Sequence(lambda n: f"Categoria {n}")

    class Meta:
        model = RestaurantCategory


class RestaurantFactory(DjangoModelFactory[Restaurant]):
    owner = LazyAttribute(lambda _: UserFactory())
    category = LazyAttribute(lambda _: RestaurantCategoryFactory())
    subscription_plan = LazyAttribute(lambda _: SubscriptionPlanFactory())
    status = LazyAttribute(lambda _: RestaurantStatusFactory())
    slug = Sequence(lambda n: f"restaurant-{n}")
    display_name = Faker("company")
    email = Faker("email")
    phone = Faker("phone_number")
    description = Faker("sentence")
    average_rating = Decimal("4.80")
    total_reviews = 24

    class Meta:
        model = Restaurant


class RestaurantAddressFactory(DjangoModelFactory[RestaurantAddress]):
    restaurant = LazyAttribute(lambda _: RestaurantFactory())
    line1 = Faker("street_address")
    city = "Corinto"
    country = "Colombia"
    is_primary = True

    class Meta:
        model = RestaurantAddress


class RestaurantOrderCapabilityFactory(DjangoModelFactory[RestaurantOrderCapability]):
    restaurant = LazyAttribute(lambda _: RestaurantFactory())
    delivery_enabled = True
    pickup_enabled = True
    table_order_enabled = False

    class Meta:
        model = RestaurantOrderCapability


class RestaurantDeliverySettingFactory(DjangoModelFactory[RestaurantDeliverySetting]):
    restaurant = LazyAttribute(lambda _: RestaurantFactory())
    delivery_fee_amount = Decimal("3000.00")
    min_order_amount = Decimal("15000.00")
    estimated_min_minutes = 25
    estimated_max_minutes = 35

    class Meta:
        model = RestaurantDeliverySetting


class RestaurantHourFactory(DjangoModelFactory[RestaurantHour]):
    restaurant = LazyAttribute(lambda _: RestaurantFactory())
    weekday = Sequence(lambda n: n % 7)
    open_time = "11:00"
    close_time = "21:00"
    is_closed = False

    class Meta:
        model = RestaurantHour


class MenuCategoryFactory(DjangoModelFactory[MenuCategory]):
    restaurant = LazyAttribute(lambda _: RestaurantFactory())
    slug = Sequence(lambda n: f"category-{n}")
    name = Sequence(lambda n: f"Categoria menu {n}")
    sort_order = Sequence(lambda n: n)
    is_active = True

    class Meta:
        model = MenuCategory


class MenuItemFactory(DjangoModelFactory[MenuItem]):
    restaurant = LazyAttribute(lambda _: RestaurantFactory())
    menu_category = LazyAttribute(
        lambda obj: MenuCategoryFactory(restaurant=obj.restaurant)
    )
    slug = Sequence(lambda n: f"menu-item-{n}")
    name = Sequence(lambda n: f"Plato {n}")
    description = Faker("sentence")
    price_amount = Decimal("18000.00")
    currency_code = "COP"
    is_available = True
    is_popular = False

    class Meta:
        model = MenuItem


class AddressTypeFactory(DjangoModelFactory[AddressType]):
    code = "home"
    name = "Casa"

    class Meta:
        model = AddressType
        django_get_or_create = ("code",)


class CustomerAddressFactory(DjangoModelFactory[CustomerAddress]):
    user = LazyAttribute(lambda _: UserFactory())
    address_type = LazyAttribute(lambda _: AddressTypeFactory())
    label = "Casa"
    line1 = "Calle 5 #12-34"
    city = "Corinto"
    country = "Colombia"
    notes = "Casa blanca"
    is_default = True

    class Meta:
        model = CustomerAddress


class OrderTypeFactory(DjangoModelFactory[OrderType]):
    code = "delivery"
    name = "Delivery"

    class Meta:
        model = OrderType
        django_get_or_create = ("code",)


class OrderStatusFactory(DjangoModelFactory[OrderStatus]):
    code = "new"
    name = "Nuevo"

    class Meta:
        model = OrderStatus
        django_get_or_create = ("code",)
