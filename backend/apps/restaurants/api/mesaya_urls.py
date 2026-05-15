"""
URLs públicas bajo /api/public/ para el frontend MesaYA.
"""
from django.urls import path
from .mesaya_views import MesaYAPublicRestaurantListView
from .mesaya_views import MesaYAPublicRestaurantDetailView
from .mesaya_views import MesaYAPublicRestaurantMenuView

app_name = "public"

urlpatterns = [
    path("restaurants/", MesaYAPublicRestaurantListView.as_view(), name="restaurant-list"),
    path("restaurants/<slug:slug>/", MesaYAPublicRestaurantDetailView.as_view(), name="restaurant-detail"),
    path("restaurants/<slug:slug>/menu/", MesaYAPublicRestaurantMenuView.as_view(), name="restaurant-menu"),
]
