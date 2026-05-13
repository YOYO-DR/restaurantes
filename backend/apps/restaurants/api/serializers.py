from django.utils import timezone
from rest_framework import serializers

from apps.menu.models import MenuCategory
from apps.menu.models import MenuItem
from apps.orders.models import Order
from apps.orders.models import OrderItem
from apps.restaurants.models import CartPosition
from apps.restaurants.models import CategoryNavigationStyle
from apps.restaurants.models import MenuLayoutOption
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantAddress
from apps.restaurants.models import RestaurantDeliverySetting
from apps.restaurants.models import RestaurantHour
from apps.restaurants.models import RestaurantOrderCapability
from apps.restaurants.models import RestaurantReview
from apps.restaurants.models import RestaurantSocialLink
from apps.restaurants.models import RestaurantTable
from apps.restaurants.models import TableStatus

WEEKDAY_LABELS = {
    0: "Lunes",
    1: "Martes",
    2: "Miercoles",
    3: "Jueves",
    4: "Viernes",
    5: "Sabado",
    6: "Domingo",
}


def serialize_branding_media(request, file_field, fallback_url: str | None = "") -> str:
    if file_field:
        media_url = file_field.url
        if request and media_url.startswith("/"):
            return request.build_absolute_uri(media_url)
        return media_url
    return fallback_url or ""


def build_default_schedule_payload(instance: Restaurant) -> list[dict[str, object]]:
    hours_by_weekday = {hour.weekday: hour for hour in instance.hours.all()}
    schedule = []

    for weekday in range(7):
        hour = hours_by_weekday.get(weekday)
        schedule.append(
            {
                "weekday": weekday,
                "open_time": (
                    hour.open_time.strftime("%H:%M:%S")
                    if hour and hour.open_time
                    else (None if hour else "09:00:00")
                ),
                "close_time": (
                    hour.close_time.strftime("%H:%M:%S")
                    if hour and hour.close_time
                    else (None if hour else "18:00:00")
                ),
                "is_closed": hour.is_closed if hour else weekday == 6,
                "label": WEEKDAY_LABELS.get(weekday, str(weekday)),
            },
        )

    return schedule


class RestaurantListSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name")
    category = serializers.CharField(source="category.name")
    city = serializers.SerializerMethodField()
    cover_url = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    has_delivery = serializers.BooleanField(
        source="order_capability.delivery_enabled",
        default=False,
    )
    has_pickup = serializers.BooleanField(
        source="order_capability.pickup_enabled",
        default=False,
    )
    delivery_fee_amount = serializers.DecimalField(
        source="delivery_setting.delivery_fee_amount",
        max_digits=12,
        decimal_places=2,
        default="0.00",
    )
    estimated_min_minutes = serializers.IntegerField(
        source="delivery_setting.estimated_min_minutes",
        default=None,
        allow_null=True,
    )
    estimated_max_minutes = serializers.IntegerField(
        source="delivery_setting.estimated_max_minutes",
        default=None,
        allow_null=True,
    )
    primary_color = serializers.CharField(source="branding.primary_color", default="")

    class Meta:
        model = Restaurant
        fields = [
            "id",
            "slug",
            "name",
            "category",
            "description",
            "average_rating",
            "total_reviews",
            "city",
            "cover_url",
            "is_open",
            "has_delivery",
            "has_pickup",
            "delivery_fee_amount",
            "estimated_min_minutes",
            "estimated_max_minutes",
            "primary_color",
        ]

    def get_city(self, obj: Restaurant) -> str:
        address = obj.addresses.filter(is_primary=True).first() or obj.addresses.first()
        return address.city if address else ""

    def get_cover_url(self, obj: Restaurant) -> str:
        branding = getattr(obj, "branding", None)
        request = self.context.get("request")
        if not branding:
            return ""
        return serialize_branding_media(
            request,
            branding.cover_file,
            branding.cover_url,
        )

    def get_is_open(self, obj: Restaurant) -> bool:
        return obj.status.code == "active"


class RestaurantHourSerializer(serializers.ModelSerializer):
    label = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantHour
        fields = ["weekday", "open_time", "close_time", "is_closed", "label"]

    def get_label(self, obj: RestaurantHour) -> str:
        weekday_label = WEEKDAY_LABELS.get(obj.weekday, str(obj.weekday))
        if obj.is_closed:
            return f"{weekday_label}: Cerrado"
        if not obj.open_time or not obj.close_time:
            return weekday_label
        return f"{weekday_label}: {obj.open_time.strftime('%H:%M')} - {obj.close_time.strftime('%H:%M')}"


class RestaurantDetailSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="display_name")
    category = serializers.CharField(source="category.name")
    cover_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    is_open = serializers.SerializerMethodField()
    has_delivery = serializers.BooleanField(
        source="order_capability.delivery_enabled",
        default=False,
    )
    has_pickup = serializers.BooleanField(
        source="order_capability.pickup_enabled",
        default=False,
    )
    has_table_order = serializers.BooleanField(
        source="order_capability.table_order_enabled",
        default=False,
    )
    address = serializers.SerializerMethodField()
    delivery_fee_amount = serializers.DecimalField(
        source="delivery_setting.delivery_fee_amount",
        max_digits=12,
        decimal_places=2,
        default="0.00",
    )
    min_order_amount = serializers.DecimalField(
        source="delivery_setting.min_order_amount",
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        default=None,
    )
    estimated_min_minutes = serializers.IntegerField(
        source="delivery_setting.estimated_min_minutes",
        default=None,
        allow_null=True,
    )
    estimated_max_minutes = serializers.IntegerField(
        source="delivery_setting.estimated_max_minutes",
        default=None,
        allow_null=True,
    )
    schedule = RestaurantHourSerializer(source="hours", many=True)
    slogan = serializers.CharField(source="branding.slogan", default="")
    welcome_message = serializers.CharField(
        source="branding.welcome_message",
        default="",
    )
    primary_color = serializers.CharField(source="branding.primary_color", default="")
    secondary_color = serializers.CharField(
        source="branding.secondary_color",
        default="",
    )
    menu_layout = serializers.CharField(
        source="branding.menu_layout_option.code",
        default="cards",
    )
    image_size = serializers.CharField(source="branding.image_size", default="medium")
    show_prices = serializers.BooleanField(source="branding.show_prices", default=True)
    show_descriptions = serializers.BooleanField(
        source="branding.show_descriptions",
        default=True,
    )
    show_tags = serializers.BooleanField(source="branding.show_tags", default=True)
    category_navigation = serializers.CharField(
        source="branding.category_navigation_style.code",
        default="tabs",
    )
    cart_position = serializers.CharField(
        source="branding.cart_position.code",
        default="sidebar",
    )
    search_enabled = serializers.BooleanField(
        source="branding.search_enabled",
        default=True,
    )
    filters_enabled = serializers.BooleanField(
        source="branding.filters_enabled",
        default=False,
    )
    dark_mode_enabled = serializers.BooleanField(
        source="branding.dark_mode_enabled",
        default=False,
    )
    social_links = serializers.SerializerMethodField()
    tables = serializers.SerializerMethodField()

    class Meta:
        model = Restaurant
        fields = [
            "id",
            "slug",
            "name",
            "category",
            "description",
            "email",
            "phone",
            "average_rating",
            "total_reviews",
            "cover_url",
            "logo_url",
            "is_open",
            "has_delivery",
            "has_pickup",
            "has_table_order",
            "address",
            "delivery_fee_amount",
            "min_order_amount",
            "estimated_min_minutes",
            "estimated_max_minutes",
            "schedule",
            "slogan",
            "welcome_message",
            "primary_color",
            "secondary_color",
            "menu_layout",
            "image_size",
            "show_prices",
            "show_descriptions",
            "show_tags",
            "category_navigation",
            "cart_position",
            "search_enabled",
            "filters_enabled",
            "dark_mode_enabled",
            "social_links",
            "tables",
        ]

    def get_is_open(self, obj: Restaurant) -> bool:
        return obj.status.code == "active"

    def get_cover_url(self, obj: Restaurant) -> str:
        branding = getattr(obj, "branding", None)
        request = self.context.get("request")
        if not branding:
            return ""
        return serialize_branding_media(
            request,
            branding.cover_file,
            branding.cover_url,
        )

    def get_logo_url(self, obj: Restaurant) -> str:
        branding = getattr(obj, "branding", None)
        request = self.context.get("request")
        if not branding:
            return ""
        return serialize_branding_media(request, branding.logo_file, branding.logo_url)

    def get_address(self, obj: Restaurant) -> dict[str, str]:
        address = obj.addresses.filter(is_primary=True).first() or obj.addresses.first()
        if not address:
            return {"line1": "", "city": "", "country": ""}
        return {
            "line1": address.line1,
            "city": address.city,
            "country": address.country,
        }

    def get_social_links(self, obj: Restaurant) -> dict[str, str]:
        social_links = getattr(obj, "social_links", None)
        if not social_links:
            return {
                "instagram_url": "",
                "facebook_url": "",
                "tiktok_url": "",
                "whatsapp_number": "",
            }
        return {
            "instagram_url": social_links.instagram_url,
            "facebook_url": social_links.facebook_url,
            "tiktok_url": social_links.tiktok_url,
            "whatsapp_number": social_links.whatsapp_number,
        }

    def get_tables(self, obj: Restaurant) -> list[dict[str, str]]:
        if (
            not getattr(obj, "order_capability", None)
            or not obj.order_capability.table_order_enabled
        ):
            return []

        return [
            {
                "id": str(table.id),
                "table_number": table.table_number,
            }
            for table in obj.tables.filter(status__code="active").order_by(
                "table_number",
            )
        ]


class PublicMenuItemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "price_amount",
            "currency_code",
            "is_available",
            "is_popular",
            "prep_time_minutes",
            "image_url",
            "images",
        ]

    def get_image_url(self, obj: MenuItem) -> str:
        primary_image = obj.images.filter(is_primary=True).first()
        return self._serialize_image(primary_image) if primary_image else ""

    def get_images(self, obj: MenuItem) -> list[dict[str, object]]:
        return [
            self._serialize_image_record(image)
            for image in obj.images.order_by("sort_order", "created_at")
        ]

    def _serialize_image(self, image) -> str:
        request = self.context.get("request") if hasattr(self, "context") else None
        if image.image_file:
            image_url = image.image_file.url
        else:
            image_url = image.image_url

        if request and image_url.startswith("/"):
            return request.build_absolute_uri(image_url)

        return image_url

    def _serialize_image_record(self, image) -> dict[str, object]:
        return {
            "id": str(image.id),
            "url": self._serialize_image(image),
            "is_primary": image.is_primary,
            "sort_order": image.sort_order,
        }


class PublicMenuCategorySerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()

    class Meta:
        model = MenuCategory
        fields = ["id", "slug", "name", "sort_order", "is_active", "items"]

    def get_items(self, obj: MenuCategory):
        items = obj.menu_items.filter(is_available=True).order_by("name")
        return PublicMenuItemSerializer(items, many=True, context=self.context).data


class OwnerMenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="menu_category.name")
    image_url = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "price_amount",
            "currency_code",
            "is_available",
            "is_popular",
            "prep_time_minutes",
            "category_name",
            "image_url",
            "images",
        ]

    def get_image_url(self, obj: MenuItem) -> str:
        primary_image = obj.images.filter(is_primary=True).first()
        return self._serialize_image(primary_image) if primary_image else ""

    def get_images(self, obj: MenuItem) -> list[dict[str, object]]:
        return [
            self._serialize_image_record(image)
            for image in obj.images.order_by("sort_order", "created_at")
        ]

    def _serialize_image(self, image) -> str:
        request = self.context.get("request") if hasattr(self, "context") else None
        if image.image_file:
            image_url = image.image_file.url
        else:
            image_url = image.image_url

        if request and image_url.startswith("/"):
            return request.build_absolute_uri(image_url)

        return image_url

    def _serialize_image_record(self, image) -> dict[str, object]:
        return {
            "id": str(image.id),
            "url": self._serialize_image(image),
            "is_primary": image.is_primary,
            "sort_order": image.sort_order,
        }


class OwnerMenuCategorySerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = MenuCategory
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "sort_order",
            "is_active",
            "item_count",
            "items",
        ]

    def get_item_count(self, obj: MenuCategory) -> int:
        return obj.menu_items.count()

    def get_items(self, obj: MenuCategory):
        items = obj.menu_items.order_by("name")
        return OwnerMenuItemSerializer(items, many=True, context=self.context).data


class OwnerDashboardRecentOrderSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    status_name = serializers.CharField(source="status.name")
    order_type_name = serializers.CharField(source="order_type.name")
    items = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_code",
            "customer_name",
            "status_name",
            "order_type_name",
            "total_amount",
            "currency_code",
            "created_at",
            "items",
        ]

    def get_customer_name(self, obj: Order) -> str:
        if obj.user:
            return obj.user.name or obj.user.email
        return obj.customer_name or obj.customer_email or "Cliente invitado"

    def get_items(self, obj: Order) -> list[str]:
        return [item.item_name_snapshot for item in obj.items.all()]


class OwnerDashboardTopProductSerializer(serializers.ModelSerializer):
    orders = serializers.IntegerField()
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        model = OrderItem
        fields = ["item_name_snapshot", "orders", "revenue"]


class RestaurantSettingsSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=180)
    phone = serializers.CharField(max_length=30, allow_blank=True)
    email = serializers.EmailField(allow_blank=True)
    currency_code = serializers.CharField(max_length=3, required=False)
    address = serializers.CharField(max_length=220, allow_blank=True)
    city = serializers.CharField(max_length=120, allow_blank=True)
    delivery_enabled = serializers.BooleanField()
    pickup_enabled = serializers.BooleanField()
    table_order_enabled = serializers.BooleanField()
    delivery_fee_amount = serializers.DecimalField(max_digits=12, decimal_places=2)
    min_order_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    estimated_min_minutes = serializers.IntegerField(allow_null=True, required=False)
    estimated_max_minutes = serializers.IntegerField(allow_null=True, required=False)
    schedule = RestaurantHourSerializer(many=True, required=False)

    def to_representation(self, instance: Restaurant):
        address = (
            instance.addresses.filter(is_primary=True).first()
            or instance.addresses.first()
        )
        capability = getattr(instance, "order_capability", None)
        delivery_setting = getattr(instance, "delivery_setting", None)
        return {
            "business_name": instance.display_name,
            "phone": instance.phone,
            "email": instance.email,
            "currency_code": instance.currency_code or "COP",
            "address": address.line1 if address else "",
            "city": address.city if address else "",
            "delivery_enabled": capability.delivery_enabled if capability else False,
            "pickup_enabled": capability.pickup_enabled if capability else False,
            "table_order_enabled": capability.table_order_enabled
            if capability
            else False,
            "delivery_fee_amount": delivery_setting.delivery_fee_amount
            if delivery_setting
            else "0.00",
            "min_order_amount": delivery_setting.min_order_amount
            if delivery_setting
            else None,
            "estimated_min_minutes": delivery_setting.estimated_min_minutes
            if delivery_setting
            else None,
            "estimated_max_minutes": delivery_setting.estimated_max_minutes
            if delivery_setting
            else None,
            "schedule": build_default_schedule_payload(instance),
        }

    def update(self, instance: Restaurant, validated_data):
        instance.display_name = validated_data.get(
            "business_name",
            instance.display_name,
        )
        instance.phone = validated_data.get("phone", instance.phone)
        instance.email = validated_data.get("email", instance.email)
        instance.currency_code = validated_data.get(
            "currency_code",
            instance.currency_code,
        )
        instance.save(update_fields=["display_name", "phone", "email", "currency_code"])

        address, _ = RestaurantAddress.objects.get_or_create(
            restaurant=instance,
            is_primary=True,
            defaults={
                "line1": validated_data.get("address", ""),
                "city": validated_data.get("city", ""),
                "country": "Colombia",
            },
        )
        address.line1 = validated_data.get("address", address.line1)
        address.city = validated_data.get("city", address.city)
        if not address.country:
            address.country = "Colombia"
        address.save(update_fields=["line1", "city", "country"])

        capability, _ = RestaurantOrderCapability.objects.get_or_create(
            restaurant=instance,
        )
        capability.delivery_enabled = validated_data.get(
            "delivery_enabled",
            capability.delivery_enabled,
        )
        capability.pickup_enabled = validated_data.get(
            "pickup_enabled",
            capability.pickup_enabled,
        )
        capability.table_order_enabled = validated_data.get(
            "table_order_enabled",
            capability.table_order_enabled,
        )
        capability.save(
            update_fields=["delivery_enabled", "pickup_enabled", "table_order_enabled"],
        )

        delivery_setting, _ = RestaurantDeliverySetting.objects.get_or_create(
            restaurant=instance,
        )
        delivery_setting.delivery_fee_amount = validated_data.get(
            "delivery_fee_amount",
            delivery_setting.delivery_fee_amount,
        )
        delivery_setting.min_order_amount = validated_data.get(
            "min_order_amount",
            delivery_setting.min_order_amount,
        )
        delivery_setting.estimated_min_minutes = validated_data.get(
            "estimated_min_minutes",
            delivery_setting.estimated_min_minutes,
        )
        delivery_setting.estimated_max_minutes = validated_data.get(
            "estimated_max_minutes",
            delivery_setting.estimated_max_minutes,
        )
        delivery_setting.save(
            update_fields=[
                "delivery_fee_amount",
                "min_order_amount",
                "estimated_min_minutes",
                "estimated_max_minutes",
            ],
        )

        schedule_items = validated_data.get("schedule", [])
        for item in schedule_items:
            hour, _ = RestaurantHour.objects.get_or_create(
                restaurant=instance,
                weekday=item["weekday"],
                defaults={
                    "open_time": item.get("open_time"),
                    "close_time": item.get("close_time"),
                    "is_closed": item.get("is_closed", False),
                },
            )
            hour.open_time = item.get("open_time")
            hour.close_time = item.get("close_time")
            hour.is_closed = item.get("is_closed", False)
            hour.save(update_fields=["open_time", "close_time", "is_closed"])

        return instance


class OwnerRestaurantReviewSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    responded = serializers.SerializerMethodField()
    response = serializers.CharField(source="owner_reply", read_only=True)
    date = serializers.DateTimeField(source="created_at", read_only=True)
    order_items = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantReview
        fields = [
            "id",
            "customer_name",
            "rating",
            "date",
            "comment",
            "responded",
            "response",
            "order_items",
        ]

    def get_customer_name(self, obj: RestaurantReview) -> str:
        if obj.user and obj.user.name:
            return obj.user.name
        if obj.user:
            return obj.user.email
        return "Cliente"

    def get_responded(self, obj: RestaurantReview) -> bool:
        return bool(obj.owner_reply)

    def get_order_items(self, obj: RestaurantReview) -> list[str]:
        if not obj.order_id:
            return []
        return [item.item_name_snapshot for item in obj.order.items.all()]


class OwnerRestaurantReviewReplySerializer(serializers.ModelSerializer):
    response = serializers.CharField(source="owner_reply")

    class Meta:
        model = RestaurantReview
        fields = ["response"]

    def update(self, instance: RestaurantReview, validated_data):
        instance.owner_reply = validated_data["owner_reply"]
        instance.owner_replied_at = timezone.now()
        instance.save(update_fields=["owner_reply", "owner_replied_at", "updated_at"])
        return instance


class OwnerRestaurantTableSerializer(serializers.ModelSerializer):
    status = serializers.CharField(source="status.code", read_only=True)
    status_name = serializers.CharField(source="status.name", read_only=True)
    qr_url = serializers.SerializerMethodField()

    class Meta:
        model = RestaurantTable
        fields = [
            "id",
            "table_number",
            "capacity",
            "status",
            "status_name",
            "qr_url",
        ]

    def get_qr_url(self, obj: RestaurantTable) -> str:
        qr_code = obj.restaurant.qr_codes.filter(target_id=obj.id).first()
        return qr_code.qr_url if qr_code else ""


class OwnerRestaurantTableWriteSerializer(serializers.ModelSerializer):
    status_code = serializers.ChoiceField(
        choices=("active", "inactive"),
        write_only=True,
        required=False,
        default="active",
    )

    class Meta:
        model = RestaurantTable
        fields = ["id", "table_number", "capacity", "status_code"]

    def create(self, validated_data):
        status_code = validated_data.pop("status_code", "active")
        validated_data["status"] = TableStatus.objects.get(code=status_code)
        validated_data["restaurant"] = self.context["restaurant"]
        return super().create(validated_data)

    def update(self, instance: RestaurantTable, validated_data):
        status_code = validated_data.pop("status_code", None)
        if status_code:
            instance.status = TableStatus.objects.get(code=status_code)
        return super().update(instance, validated_data)


class RestaurantPersonalizationSerializer(serializers.Serializer):
    logo_file = serializers.FileField(required=False, allow_null=True, write_only=True)
    cover_file = serializers.FileField(required=False, allow_null=True, write_only=True)
    remove_logo = serializers.BooleanField(required=False)
    remove_cover = serializers.BooleanField(required=False)
    logo_url = serializers.URLField(allow_blank=True, required=False)
    cover_url = serializers.URLField(allow_blank=True, required=False)
    primary_color = serializers.CharField(
        max_length=15,
        required=False,
        allow_blank=True,
    )
    secondary_color = serializers.CharField(
        max_length=15,
        required=False,
        allow_blank=True,
    )
    slogan = serializers.CharField(max_length=180, required=False, allow_blank=True)
    welcome_message = serializers.CharField(required=False, allow_blank=True)
    menu_layout = serializers.ChoiceField(
        choices=("cards", "list", "grid"),
        required=False,
    )
    image_size = serializers.ChoiceField(
        choices=("small", "medium", "large"),
        required=False,
    )
    show_prices = serializers.BooleanField(required=False)
    show_descriptions = serializers.BooleanField(required=False)
    show_tags = serializers.BooleanField(required=False)
    category_navigation = serializers.ChoiceField(
        choices=("tabs", "sidebar", "dropdown"),
        required=False,
    )
    cart_position = serializers.ChoiceField(
        choices=("sidebar", "bottom", "floating"),
        required=False,
    )
    search_enabled = serializers.BooleanField(required=False)
    filters_enabled = serializers.BooleanField(required=False)
    dark_mode_enabled = serializers.BooleanField(required=False)
    restaurant_name = serializers.CharField(max_length=180, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    address = serializers.CharField(max_length=220, required=False, allow_blank=True)
    instagram_url = serializers.CharField(required=False, allow_blank=True)
    facebook_url = serializers.CharField(required=False, allow_blank=True)
    tiktok_url = serializers.CharField(required=False, allow_blank=True)
    whatsapp_number = serializers.CharField(required=False, allow_blank=True)

    def to_representation(self, instance: Restaurant):
        branding = getattr(instance, "branding", None)
        social_links = getattr(instance, "social_links", None)
        request = self.context.get("request") if hasattr(self, "context") else None
        address = (
            instance.addresses.filter(is_primary=True).first()
            or instance.addresses.first()
        )

        return {
            "logo_url": (
                serialize_branding_media(request, branding.logo_file, branding.logo_url)
                if branding
                else ""
            ),
            "cover_url": (
                serialize_branding_media(
                    request,
                    branding.cover_file,
                    branding.cover_url,
                )
                if branding
                else ""
            ),
            "slug": instance.slug,
            "primary_color": branding.primary_color if branding else "#e85d04",
            "secondary_color": branding.secondary_color if branding else "#16a34a",
            "slogan": branding.slogan if branding else "",
            "welcome_message": branding.welcome_message if branding else "",
            "menu_layout": branding.menu_layout_option.code if branding else "cards",
            "image_size": branding.image_size if branding else "medium",
            "show_prices": branding.show_prices if branding else True,
            "show_descriptions": branding.show_descriptions if branding else True,
            "show_tags": branding.show_tags if branding else True,
            "category_navigation": branding.category_navigation_style.code
            if branding
            else "tabs",
            "cart_position": branding.cart_position.code if branding else "sidebar",
            "search_enabled": branding.search_enabled if branding else True,
            "filters_enabled": branding.filters_enabled if branding else False,
            "dark_mode_enabled": branding.dark_mode_enabled if branding else False,
            "restaurant_name": instance.display_name,
            "description": instance.description,
            "phone": instance.phone,
            "email": instance.email,
            "address": address.line1 if address else "",
            "instagram_url": social_links.instagram_url if social_links else "",
            "facebook_url": social_links.facebook_url if social_links else "",
            "tiktok_url": social_links.tiktok_url if social_links else "",
            "whatsapp_number": social_links.whatsapp_number if social_links else "",
        }

    def update(self, instance: Restaurant, validated_data):
        from apps.restaurants.services import ensure_restaurant_branding

        branding = ensure_restaurant_branding(instance)
        social_links = getattr(instance, "social_links", None)
        if social_links is None:
            social_links = RestaurantSocialLink.objects.create(restaurant=instance)
        address = (
            instance.addresses.filter(is_primary=True).first()
            or instance.addresses.first()
        )

        instance.display_name = validated_data.get(
            "restaurant_name",
            instance.display_name,
        )
        instance.description = validated_data.get("description", instance.description)
        instance.phone = validated_data.get("phone", instance.phone)
        instance.email = validated_data.get("email", instance.email)
        instance.save(update_fields=["display_name", "description", "phone", "email"])

        if address:
            address.line1 = validated_data.get("address", address.line1)
            address.save(update_fields=["line1", "updated_at"])

        branding.logo_url = validated_data.get("logo_url", branding.logo_url)
        branding.cover_url = validated_data.get("cover_url", branding.cover_url)
        if validated_data.get("remove_logo"):
            branding.logo_file = None
            branding.logo_url = ""
        if validated_data.get("remove_cover"):
            branding.cover_file = None
            branding.cover_url = ""
        if validated_data.get("logo_file"):
            branding.logo_file = validated_data["logo_file"]
            branding.logo_url = ""
        if validated_data.get("cover_file"):
            branding.cover_file = validated_data["cover_file"]
            branding.cover_url = ""
        branding.primary_color = validated_data.get(
            "primary_color",
            branding.primary_color,
        )
        branding.secondary_color = validated_data.get(
            "secondary_color",
            branding.secondary_color,
        )
        branding.slogan = validated_data.get("slogan", branding.slogan)
        branding.welcome_message = validated_data.get(
            "welcome_message",
            branding.welcome_message,
        )
        branding.image_size = validated_data.get("image_size", branding.image_size)
        branding.show_prices = validated_data.get("show_prices", branding.show_prices)
        branding.show_descriptions = validated_data.get(
            "show_descriptions",
            branding.show_descriptions,
        )
        branding.show_tags = validated_data.get("show_tags", branding.show_tags)
        branding.search_enabled = validated_data.get(
            "search_enabled",
            branding.search_enabled,
        )
        branding.filters_enabled = validated_data.get(
            "filters_enabled",
            branding.filters_enabled,
        )
        branding.dark_mode_enabled = validated_data.get(
            "dark_mode_enabled",
            branding.dark_mode_enabled,
        )
        branding.menu_layout_option = MenuLayoutOption.objects.get(
            code=validated_data.get("menu_layout", branding.menu_layout_option.code),
        )
        branding.category_navigation_style = CategoryNavigationStyle.objects.get(
            code=validated_data.get(
                "category_navigation",
                branding.category_navigation_style.code,
            ),
        )
        branding.cart_position = CartPosition.objects.get(
            code=validated_data.get("cart_position", branding.cart_position.code),
        )
        branding.save()

        social_links.instagram_url = validated_data.get(
            "instagram_url",
            social_links.instagram_url,
        )
        social_links.facebook_url = validated_data.get(
            "facebook_url",
            social_links.facebook_url,
        )
        social_links.tiktok_url = validated_data.get(
            "tiktok_url",
            social_links.tiktok_url,
        )
        social_links.whatsapp_number = validated_data.get(
            "whatsapp_number",
            social_links.whatsapp_number,
        )
        social_links.save()

        return instance
