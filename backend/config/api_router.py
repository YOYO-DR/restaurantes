from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from apps.accounts.api.views import AccountProfileViewSet
from apps.menu.api.views import OwnerMenuCategoryViewSet
from apps.menu.api.views import OwnerMenuCrudItemViewSet
from apps.menu.api.views import OwnerInventoryItemViewSet
from apps.menu.api.views import OwnerInventoryMetadataViewSet
from apps.menu.api.views import OwnerMenuItemViewSet
from apps.customers.api.views import CustomerAddressViewSet
from apps.customers.api.views import CustomerDashboardViewSet
from apps.customers.api.views import FavoriteViewSet
from apps.loyalty.api.views import CustomerLoyaltyViewSet
from apps.orders.api.views import CheckoutViewSet
from apps.orders.api.views import CustomerOrderViewSet
from apps.orders.api.views import OwnerOrderViewSet
from apps.restaurants.api.views import OwnerRestaurantViewSet
from apps.restaurants.api.views import PublicRestaurantViewSet
from apps.users.api.views import UserViewSet

router = DefaultRouter() if settings.DEBUG else SimpleRouter()

router.register("account/profile", AccountProfileViewSet, basename="account-profile")
router.register("users", UserViewSet)
router.register("restaurants", PublicRestaurantViewSet, basename="restaurant")
router.register(
    "customer/addresses", CustomerAddressViewSet, basename="customer-address"
)
router.register(
    "customer/dashboard", CustomerDashboardViewSet, basename="customer-dashboard"
)
router.register("customer/favorites", FavoriteViewSet, basename="customer-favorite")
router.register("customer/loyalty", CustomerLoyaltyViewSet, basename="customer-loyalty")
router.register("checkout/orders", CheckoutViewSet, basename="checkout-order")
router.register("customer/orders", CustomerOrderViewSet, basename="customer-order")
router.register("owner/orders", OwnerOrderViewSet, basename="owner-order")
router.register(
    "owner/restaurants", OwnerRestaurantViewSet, basename="owner-restaurant"
)
router.register("owner/menu-items", OwnerMenuItemViewSet, basename="owner-menu-item")
router.register(
    "owner/inventory-metadata",
    OwnerInventoryMetadataViewSet,
    basename="owner-inventory-metadata",
)
router.register(
    "owner/inventory-items",
    OwnerInventoryItemViewSet,
    basename="owner-inventory-item",
)
router.register(
    "owner/menu-categories",
    OwnerMenuCategoryViewSet,
    basename="owner-menu-category",
)
router.register(
    "owner/menu-crud-items",
    OwnerMenuCrudItemViewSet,
    basename="owner-menu-crud-item",
)


app_name = "api"
urlpatterns = router.urls
