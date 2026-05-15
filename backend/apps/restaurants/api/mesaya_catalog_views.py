"""
Endpoints de catálogo y settings públicos para el frontend MesaYA.
Montados bajo /api/catalog/ y /api/
"""
from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers

from apps.restaurants.models import RestaurantCategory
from apps.platform_config.models import PlatformSetting


# ── Catalog Options ──────────────────────────────────────────────────────────

class CatalogOptionSerializer(serializers.Serializer):
    key = serializers.CharField()
    label = serializers.CharField()
    label_en = serializers.CharField()
    color = serializers.CharField()
    icon = serializers.CharField()
    sort_order = serializers.IntegerField()
    metadata = serializers.DictField()


class OptionListView(APIView):
    """Devuelve opciones predefinidas del sistema agrupadas por 'group'."""
    permission_classes = [permissions.AllowAny]

    OPTIONS = {
        "order_status": [
            {"key": "pending", "label": "Pendiente", "label_en": "Pending", "color": "#f59e0b", "icon": "clock", "sort_order": 1, "metadata": {}},
            {"key": "confirmed", "label": "Confirmado", "label_en": "Confirmed", "color": "#3b82f6", "icon": "check", "sort_order": 2, "metadata": {}},
            {"key": "preparing", "label": "Preparando", "label_en": "Preparing", "color": "#8b5cf6", "icon": "utensils", "sort_order": 3, "metadata": {}},
            {"key": "ready", "label": "Listo", "label_en": "Ready", "color": "#10b981", "icon": "package-check", "sort_order": 4, "metadata": {}},
            {"key": "on_the_way", "label": "En camino", "label_en": "On the way", "color": "#06b6d4", "icon": "truck", "sort_order": 5, "metadata": {}},
            {"key": "delivered", "label": "Entregado", "label_en": "Delivered", "color": "#22c55e", "icon": "check-circle", "sort_order": 6, "metadata": {}},
            {"key": "cancelled", "label": "Cancelado", "label_en": "Cancelled", "color": "#ef4444", "icon": "x-circle", "sort_order": 7, "metadata": {}},
        ],
        "payment_method": [
            {"key": "cash", "label": "Efectivo", "label_en": "Cash", "color": "#22c55e", "icon": "banknote", "sort_order": 1, "metadata": {}},
            {"key": "credit_card", "label": "Tarjeta de crédito", "label_en": "Credit card", "color": "#3b82f6", "icon": "credit-card", "sort_order": 2, "metadata": {}},
            {"key": "debit_card", "label": "Tarjeta débito", "label_en": "Debit card", "color": "#8b5cf6", "icon": "credit-card", "sort_order": 3, "metadata": {}},
            {"key": "transfer", "label": "Transferencia", "label_en": "Bank transfer", "color": "#f59e0b", "icon": "bank", "sort_order": 4, "metadata": {}},
        ],
        "restaurant_status": [
            {"key": "pending", "label": "Pendiente", "label_en": "Pending", "color": "#f59e0b", "icon": "clock", "sort_order": 1, "metadata": {}},
            {"key": "approved", "label": "Aprobado", "label_en": "Approved", "color": "#22c55e", "icon": "check", "sort_order": 2, "metadata": {}},
            {"key": "suspended", "label": "Suspendido", "label_en": "Suspended", "color": "#ef4444", "icon": "pause", "sort_order": 3, "metadata": {}},
            {"key": "rejected", "label": "Rechazado", "label_en": "Rejected", "color": "#ef4444", "icon": "x", "sort_order": 4, "metadata": {}},
        ],
        "promo_type": [
            {"key": "percentage", "label": "Porcentaje", "label_en": "Percentage", "color": "#3b82f6", "icon": "percent", "sort_order": 1, "metadata": {}},
            {"key": "fixed", "label": "Monto fijo", "label_en": "Fixed amount", "color": "#22c55e", "icon": "dollar-sign", "sort_order": 2, "metadata": {}},
            {"key": "free_delivery", "label": "Envío gratis", "label_en": "Free delivery", "color": "#06b6d4", "icon": "truck", "sort_order": 3, "metadata": {}},
        ],
        "city_zone": [
            {"key": "norte", "label": "Norte", "label_en": "North", "color": "#3b82f6", "icon": "map-pin", "sort_order": 1, "metadata": {}},
            {"key": "sur", "label": "Sur", "label_en": "South", "color": "#22c55e", "icon": "map-pin", "sort_order": 2, "metadata": {}},
            {"key": "este", "label": "Oriente", "label_en": "East", "color": "#f59e0b", "icon": "map-pin", "sort_order": 3, "metadata": {}},
            {"key": "oeste", "label": "Occidente", "label_en": "West", "color": "#8b5cf6", "icon": "map-pin", "sort_order": 4, "metadata": {}},
            {"key": "centro", "label": "Centro", "label_en": "Downtown", "color": "#ef4444", "icon": "map-pin", "sort_order": 5, "metadata": {}},
        ],
    }

    def get(self, request):
        group = request.query_params.get("group")
        if group and group in self.OPTIONS:
            return Response(self.OPTIONS[group])
        if group:
            return Response([])
        return Response([])


# ── Restaurant Categories ────────────────────────────────────────────────────

class RestaurantCategorySerializer(serializers.ModelSerializer):
    slug = serializers.CharField(source="code")
    icon = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    sort_order = serializers.IntegerField(default=0)

    class Meta:
        model = RestaurantCategory
        fields = ["id", "name", "slug", "icon", "image_url", "sort_order"]

    def get_icon(self, obj):
        return ""

    def get_image_url(self, obj):
        return ""


class RestaurantCategoryListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RestaurantCategorySerializer
    pagination_class = None
    queryset = RestaurantCategory.objects.filter(is_active=True).order_by("name")


# ── Public Settings ──────────────────────────────────────────────────────────

class PublicSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        settings_qs = PlatformSetting.objects.first()
        data = {
            "tax_rate": 0.19,
            "platform_name": getattr(settings_qs, "platform_name", "MesaYA") if settings_qs else "MesaYA",
            "currency": getattr(settings_qs, "default_currency_code", "COP") if settings_qs else "COP",
            "currency_symbol": "$",
        }
        return Response(data)


# ── Public CMS ───────────────────────────────────────────────────────────────

class PublicCMSView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        return Response(
            {"slug": slug, "title": slug.replace("-", " ").title(),
             "content": "", "status_key": "published",
             "published_at": None, "meta_title": ""}
        )
