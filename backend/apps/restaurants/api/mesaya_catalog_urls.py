"""URLs de catálogo y settings para MesaYA bajo /api/"""
from django.urls import path
from .mesaya_catalog_views import OptionListView
from .mesaya_catalog_views import RestaurantCategoryListView
from .mesaya_catalog_views import PublicSettingsView
from .mesaya_catalog_views import PublicCMSView

app_name = "mesaya_catalog"

urlpatterns = [
    path("catalog/options/", OptionListView.as_view(), name="catalog-options"),
    path("catalog/restaurant-categories/", RestaurantCategoryListView.as_view(), name="catalog-categories"),
    path("settings/public/", PublicSettingsView.as_view(), name="public-settings"),
    path("cms/<slug:slug>/", PublicCMSView.as_view(), name="public-cms"),
]
