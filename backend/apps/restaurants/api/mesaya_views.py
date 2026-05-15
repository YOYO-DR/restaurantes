"""
Vistas públicas adaptadas al contrato del frontend MesaYA.
Montadas bajo /api/public/
"""
from rest_framework import generics
from rest_framework import permissions
from rest_framework import filters
from rest_framework.response import Response

from apps.restaurants.models import Restaurant
from .mesaya_serializers import MesaYARestaurantListSerializer
from .mesaya_serializers import MesaYARestaurantDetailSerializer
from .mesaya_serializers import MesaYAMenuCategorySerializer


class MesaYAPublicRestaurantListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MesaYARestaurantListSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["display_name", "description"]
    ordering_fields = ["display_name", "average_rating", "total_reviews"]
    ordering = ["-average_rating"]

    def get_queryset(self):
        qs = (
            Restaurant.objects
            .select_related("category", "status", "branding", "delivery_setting")
            .prefetch_related("addresses", "hours")
            .filter(status__code="active")
        )

        city = self.request.query_params.get("city")
        zone = self.request.query_params.get("zone")
        category = self.request.query_params.get("category")
        is_open = self.request.query_params.get("is_open")
        min_rating = self.request.query_params.get("min_rating")

        if city:
            qs = qs.filter(addresses__city__iexact=city)
        if zone:
            qs = qs.filter(addresses__city__iexact=zone)
        if category:
            qs = qs.filter(category__code__iexact=category)
        if is_open is not None:
            val = is_open.lower() == "true"
            if val:
                qs = qs.filter(status__code="active")
            else:
                qs = qs.exclude(status__code="active")
        if min_rating:
            try:
                qs = qs.filter(average_rating__gte=float(min_rating))
            except (ValueError, TypeError):
                pass

        return qs.distinct().order_by("-average_rating", "display_name")


class MesaYAPublicRestaurantDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MesaYARestaurantDetailSerializer
    lookup_field = "slug"
    queryset = (
        Restaurant.objects
        .select_related("category", "status", "branding", "delivery_setting", "social_links")
        .prefetch_related("addresses", "hours")
        .filter(status__code="active")
    )


class MesaYAPublicRestaurantMenuView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MesaYARestaurantDetailSerializer
    lookup_field = "slug"
    queryset = Restaurant.objects.filter(status__code="active")

    def retrieve(self, request, *args, **kwargs):
        restaurant = self.get_object()
        categories = restaurant.menu_categories.filter(is_active=True).prefetch_related(
            "menu_items__images", "menu_items__tags",
        )
        serializer = MesaYAMenuCategorySerializer(
            categories, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)
