"""
Serializers adaptados al contrato del frontend MesaYA.
El frontend espera el formato definido en src/lib/api/restaurants.ts
"""
from rest_framework import serializers
from apps.menu.models import MenuCategory
from apps.menu.models import MenuItem
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantHour

WEEKDAY_LABELS = {
    0: "Lunes",
    1: "Martes",
    2: "Miercoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sabado",
    6: "Domingo",
}


def _media_url(request, file_field, fallback_url=""):
    if file_field:
        media_url = file_field.url
        if request and media_url.startswith("/"):
            return request.build_absolute_uri(media_url)
        return media_url
    return fallback_url or ""


# ── Lista ────────────────────────────────────────────────────────────────────


class MesaYARestaurantListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name")
    tagline = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    categories = serializers.SerializerMethodField()
    delivery_time_min = serializers.IntegerField(
        source="delivery_setting.estimated_min_minutes", default=25
    )
    delivery_time_max = serializers.IntegerField(
        source="delivery_setting.estimated_max_minutes", default=40
    )
    delivery_fee = serializers.CharField(source="delivery_setting.delivery_fee_amount")
    min_order_value = serializers.CharField(
        source="delivery_setting.min_order_amount", default="0"
    )
    is_open = serializers.BooleanField(default=True)
    rating_avg = serializers.CharField(source="average_rating")
    rating_count = serializers.IntegerField(source="total_reviews")
    total_orders = serializers.SerializerMethodField()
    is_featured = serializers.SerializerMethodField()
    status_key = serializers.SerializerMethodField()
    zone_key = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "id", "name", "slug", "tagline", "logo_url", "cover_url",
            "categories", "delivery_time_min", "delivery_time_max",
            "delivery_fee", "min_order_value", "is_open",
            "rating_avg", "rating_count", "total_orders",
            "is_featured", "status_key", "zone_key",
        ]

    def get_tagline(self, obj):
        return getattr(getattr(obj, "branding", None), "slogan", "") or ""

    def get_logo_url(self, obj):
        branding = getattr(obj, "branding", None)
        if not branding:
            return ""
        return _media_url(self.context.get("request"), branding.logo_file, branding.logo_url)

    def get_cover_url(self, obj):
        branding = getattr(obj, "branding", None)
        if not branding:
            return ""
        return _media_url(self.context.get("request"), branding.cover_file, branding.cover_url)

    def get_categories(self, obj):
        cat = obj.category
        if not cat:
            return []
        return [{
            "id": str(cat.id), "name": cat.name, "slug": cat.code,
            "icon": "", "image_url": "", "sort_order": 0,
        }]

    def get_total_orders(self, obj):
        return getattr(obj, "total_orders", 0)

    def get_is_featured(self, obj):
        return getattr(obj, "is_featured", False)

    def get_status_key(self, obj):
        return obj.status.code if obj.status else None

    def get_zone_key(self, obj):
        address = obj.addresses.filter(is_primary=True).first() or obj.addresses.first()
        return address.city if address else None


# ── Detalle ──────────────────────────────────────────────────────────────────


class MesaYARestaurantDetailSerializer(MesaYARestaurantListSerializer):
    description = serializers.CharField(default="")
    email = serializers.EmailField(default="")
    phone = serializers.CharField(default="")
    website = serializers.SerializerMethodField()
    branches = serializers.SerializerMethodField()
    gallery = serializers.SerializerMethodField()

    class Meta(MesaYARestaurantListSerializer.Meta):
        fields = MesaYARestaurantListSerializer.Meta.fields + [
            "description", "email", "phone", "website", "branches", "gallery",
        ]

    def get_website(self, obj):
        sl = getattr(obj, "social_links", None)
        return sl.website_url if sl else ""

    def get_branches(self, obj):
        address = obj.addresses.filter(is_primary=True).first()
        if not address:
            return []
        hours = obj.hours.all()
        schedules = []
        for h in hours:
            schedules.append({
                "day_of_week": h.weekday,
                "opens_at": h.open_time.strftime("%H:%M:%S") if h.open_time else None,
                "closes_at": h.close_time.strftime("%H:%M:%S") if h.close_time else None,
                "is_closed": h.is_closed,
            })
        return [{
            "id": str(obj.id),
            "name": obj.display_name,
            "phone": obj.phone,
            "is_main": True,
            "is_open": obj.status.code == "active",
            "delivery_radius_km": str(getattr(obj.delivery_setting, "max_delivery_radius_km", "5")),
            "delivery_fee": str(getattr(obj.delivery_setting, "delivery_fee_amount", "0.00")),
            "estimated_delivery_min": getattr(obj.delivery_setting, "estimated_min_minutes", 25),
            "schedules": schedules,
        }]

    def get_gallery(self, obj):
        return []


# ── Menú ─────────────────────────────────────────────────────────────────────


class MesaYAMenuItemSerializer(serializers.ModelSerializer):
    price = serializers.CharField(source="price_amount")
    image_url = serializers.SerializerMethodField()
    calories = serializers.SerializerMethodField()
    prep_time_min = serializers.IntegerField(source="prep_time_minutes")
    is_featured = serializers.BooleanField(default=False)
    dietary_tags = serializers.SerializerMethodField()
    variants = serializers.SerializerMethodField()
    extras = serializers.SerializerMethodField()
    sort_order = serializers.IntegerField(default=0)

    class Meta:
        model = MenuItem
        fields = [
            "id", "name", "description", "price", "image_url",
            "calories", "prep_time_min", "is_available", "is_popular",
            "is_featured", "dietary_tags", "variants", "extras", "sort_order",
        ]

    def get_image_url(self, obj):
        primary = obj.images.filter(is_primary=True).first()
        if not primary:
            return ""
        return _media_url(self.context.get("request"), primary.image_file, primary.image_url)

    def get_calories(self, obj):
        return None

    def get_dietary_tags(self, obj):
        return [
            {"key": t.code, "label": t.name, "icon": ""}
            for t in obj.tags.all()
        ]

    def get_variants(self, obj):
        return []

    def get_extras(self, obj):
        return []


class MesaYAMenuCategorySerializer(serializers.ModelSerializer):
    description = serializers.CharField(default="")
    image_url = serializers.SerializerMethodField()
    items = MesaYAMenuItemSerializer(source="menu_items", many=True, read_only=True)

    class Meta:
        model = MenuCategory
        fields = ["id", "name", "slug", "description", "image_url", "sort_order", "items"]

    def get_image_url(self, obj):
        return ""
