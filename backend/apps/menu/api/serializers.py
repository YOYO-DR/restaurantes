from django.utils.text import slugify
from rest_framework import serializers

from apps.core.permissions import get_operator_restaurant_id
from apps.core.permissions import is_admin_user
from apps.menu.models import InventoryItem
from apps.menu.models import InventoryMovementType
from apps.menu.models import InventoryStockMovement
from apps.menu.models import MenuCategory
from apps.menu.models import MenuItem
from apps.menu.models import MenuItemImage
from apps.menu.models import UnitType
from apps.restaurants.models import Restaurant


class OwnerMenuCategoryWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuCategory
        fields = [
            "id",
            "restaurant",
            "slug",
            "name",
            "description",
            "sort_order",
            "is_active",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
            "sort_order": {"required": False},
            "is_active": {"required": False},
        }
        validators = []

    def _build_unique_slug(self, restaurant: Restaurant, name: str) -> str:
        base_slug = slugify(name)[:110] or "categoria"
        candidate = base_slug
        suffix = 2
        queryset = MenuCategory.objects.filter(restaurant=restaurant)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        while queryset.filter(slug=candidate).exists():
            candidate = f"{base_slug[:110]}-{suffix}"[:120]
            suffix += 1

        return candidate

    def validate_restaurant(self, value: Restaurant) -> Restaurant:
        request = self.context["request"]
        if is_admin_user(request.user):
            return value
        if value.owner_id != request.user.id:
            operator_restaurant_id = get_operator_restaurant_id(request.user)
            if value.id != operator_restaurant_id:
                raise serializers.ValidationError(
                    "No puedes gestionar categorias de este restaurante.",
                )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        restaurant = attrs.get("restaurant") or getattr(
            self.instance,
            "restaurant",
            None,
        )
        name = attrs.get("name") or getattr(self.instance, "name", "")

        if restaurant and name:
            attrs["slug"] = self._build_unique_slug(restaurant, name)

        attrs.setdefault("sort_order", getattr(self.instance, "sort_order", 0))
        attrs.setdefault("is_active", getattr(self.instance, "is_active", True))

        return attrs


class OwnerMenuItemWriteSerializer(serializers.ModelSerializer):
    primary_image = serializers.FileField(
        required=False,
        allow_null=True,
        write_only=True,
    )
    gallery_images = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
    )
    remove_primary_image = serializers.BooleanField(required=False, write_only=True)
    remove_gallery_image_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "restaurant",
            "menu_category",
            "slug",
            "name",
            "description",
            "price_amount",
            "currency_code",
            "is_available",
            "is_popular",
            "prep_time_minutes",
            "primary_image",
            "gallery_images",
            "remove_primary_image",
            "remove_gallery_image_ids",
        ]
        extra_kwargs = {
            "slug": {"required": False, "allow_blank": True},
            "currency_code": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
        }
        validators = []

    def _build_unique_slug(self, restaurant: Restaurant, name: str) -> str:
        base_slug = slugify(name)[:130] or "plato"
        candidate = base_slug
        suffix = 2
        queryset = MenuItem.objects.filter(restaurant=restaurant)

        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)

        while queryset.filter(slug=candidate).exists():
            candidate = f"{base_slug[:130]}-{suffix}"[:140]
            suffix += 1

        return candidate

    def validate_restaurant(self, value: Restaurant) -> Restaurant:
        request = self.context["request"]
        if is_admin_user(request.user):
            return value
        if value.owner_id != request.user.id:
            operator_restaurant_id = get_operator_restaurant_id(request.user)
            if value.id != operator_restaurant_id:
                raise serializers.ValidationError(
                    "No puedes gestionar platos de este restaurante.",
                )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        restaurant = attrs.get("restaurant") or getattr(
            self.instance,
            "restaurant",
            None,
        )
        menu_category = attrs.get("menu_category") or getattr(
            self.instance,
            "menu_category",
            None,
        )
        name = attrs.get("name") or getattr(self.instance, "name", "")

        if (
            restaurant
            and menu_category
            and menu_category.restaurant_id != restaurant.id
        ):
            raise serializers.ValidationError(
                {
                    "menu_category": "La categoria no pertenece al restaurante seleccionado.",
                },
            )

        if restaurant and name:
            attrs["slug"] = self._build_unique_slug(restaurant, name)

        if restaurant:
            attrs["currency_code"] = restaurant.currency_code or "COP"

        return attrs

    def _sync_images(
        self,
        menu_item: MenuItem,
        primary_image,
        gallery_images: list,
    ) -> None:
        if primary_image:
            menu_item.images.update(is_primary=False)
            primary_record = menu_item.images.order_by(
                "sort_order",
                "created_at",
            ).first()

            if primary_record:
                primary_record.image_file = primary_image
                primary_record.image_url = ""
                primary_record.is_primary = True
                primary_record.sort_order = 0
                primary_record.save(
                    update_fields=[
                        "image_file",
                        "image_url",
                        "is_primary",
                        "sort_order",
                    ],
                )
            else:
                MenuItemImage.objects.create(
                    menu_item=menu_item,
                    image_file=primary_image,
                    image_url="",
                    is_primary=True,
                    sort_order=0,
                )

        existing_sort_order = (
            menu_item.images.order_by("-sort_order")
            .values_list("sort_order", flat=True)
            .first()
            or 0
        )

        for index, image_file in enumerate(gallery_images, start=1):
            MenuItemImage.objects.create(
                menu_item=menu_item,
                image_file=image_file,
                image_url="",
                is_primary=False,
                sort_order=existing_sort_order + index,
            )

    def _delete_image_record(self, image: MenuItemImage) -> None:
        if image.image_file:
            image.image_file.delete(save=False)
        image.delete()

    def _remove_images(
        self,
        menu_item: MenuItem,
        remove_primary_image: bool,
        remove_gallery_image_ids: list,
    ) -> None:
        if remove_primary_image:
            primary_record = (
                menu_item.images.filter(is_primary=True)
                .order_by("sort_order", "created_at")
                .first()
            )
            if primary_record:
                self._delete_image_record(primary_record)

        if remove_gallery_image_ids:
            removable_gallery_images = menu_item.images.filter(
                pk__in=remove_gallery_image_ids,
                is_primary=False,
            )
            for image in removable_gallery_images:
                self._delete_image_record(image)

    def create(self, validated_data):
        primary_image = validated_data.pop("primary_image", None)
        gallery_images = validated_data.pop("gallery_images", [])
        validated_data.pop("remove_primary_image", None)
        validated_data.pop("remove_gallery_image_ids", None)
        menu_item = super().create(validated_data)
        self._sync_images(menu_item, primary_image, gallery_images)
        return menu_item

    def update(self, instance, validated_data):
        primary_image = validated_data.pop("primary_image", None)
        gallery_images = validated_data.pop("gallery_images", [])
        remove_primary_image = validated_data.pop("remove_primary_image", False)
        remove_gallery_image_ids = validated_data.pop("remove_gallery_image_ids", [])
        menu_item = super().update(instance, validated_data)
        self._remove_images(menu_item, remove_primary_image, remove_gallery_image_ids)
        self._sync_images(menu_item, primary_image, gallery_images)
        return menu_item


class MenuItemAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ["id", "is_available"]


class InventoryUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitType
        fields = ["id", "code", "name"]


class InventoryItemSerializer(serializers.ModelSerializer):
    current_stock = serializers.DecimalField(max_digits=14, decimal_places=2)
    min_stock = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    max_stock = serializers.DecimalField(
        max_digits=14,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    unit = serializers.CharField(source="unit_type.name", read_only=True)
    unit_code = serializers.CharField(source="unit_type.code", read_only=True)
    status = serializers.SerializerMethodField()
    last_updated = serializers.DateTimeField(source="updated_at", read_only=True)
    movements = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "restaurant",
            "sku",
            "name",
            "unit_type",
            "unit",
            "unit_code",
            "current_stock",
            "min_stock",
            "max_stock",
            "status",
            "last_updated",
            "movements",
        ]
        extra_kwargs = {
            "restaurant": {"required": False},
            "sku": {"required": False, "allow_blank": True},
            "min_stock": {"required": False, "allow_null": True},
            "max_stock": {"required": False, "allow_null": True},
        }
        validators = []

    def validate_restaurant(self, value: Restaurant) -> Restaurant:
        request = self.context["request"]
        if is_admin_user(request.user):
            return value
        if value.owner_id != request.user.id:
            operator_restaurant_id = get_operator_restaurant_id(request.user)
            if value.id != operator_restaurant_id:
                raise serializers.ValidationError(
                    "No puedes gestionar inventario de este restaurante.",
                )
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        restaurant = attrs.get("restaurant") or getattr(
            self.instance,
            "restaurant",
            None,
        )

        if restaurant is None:
            owner_restaurant = Restaurant.objects.filter(
                owner=self.context["request"].user,
            ).first()
            if owner_restaurant:
                attrs["restaurant"] = owner_restaurant
            else:
                operator_restaurant_id = get_operator_restaurant_id(
                    self.context["request"].user,
                )
                if operator_restaurant_id:
                    attrs["restaurant"] = Restaurant.objects.get(
                        id=operator_restaurant_id,
                    )

        return attrs

    def get_status(self, obj: InventoryItem) -> str:
        if obj.min_stock is not None and obj.current_stock <= obj.min_stock:
            difference = obj.min_stock - obj.current_stock
            if difference > 0:
                return "critical" if obj.current_stock == 0 else "low"

        return "ok"

    def get_movements(self, obj: InventoryItem) -> list[dict[str, str]]:
        return [
            {
                "id": str(movement.id),
                "movement_type_code": movement.movement_type.code,
                "movement_type_name": movement.movement_type.name,
                "quantity": f"{movement.quantity:.2f}",
                "reason": movement.reason,
                "created_at": movement.created_at.isoformat(),
                "created_by": movement.created_by.name if movement.created_by else "",
            }
            for movement in obj.movements.select_related(
                "movement_type",
                "created_by",
            ).order_by("-created_at")[:10]
        ]


class InventoryMovementCreateSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=14, decimal_places=2)
    movement_type_code = serializers.ChoiceField(
        choices=("stock_in", "stock_out", "stock_adjustment"),
    )
    reason = serializers.CharField(required=False, allow_blank=True)

    def save(self, **kwargs):
        inventory_item: InventoryItem = self.context["inventory_item"]
        movement_type = InventoryMovementType.objects.get(
            code=self.validated_data["movement_type_code"],
        )
        quantity = self.validated_data["quantity"]
        movement_type_code = self.validated_data["movement_type_code"]

        if movement_type_code == "stock_in":
            inventory_item.current_stock += quantity
        elif movement_type_code == "stock_out":
            inventory_item.current_stock -= quantity
        else:
            inventory_item.current_stock = quantity

        inventory_item.save(update_fields=["current_stock", "updated_at"])

        return InventoryStockMovement.objects.create(
            inventory_item=inventory_item,
            movement_type=movement_type,
            quantity=quantity,
            reason=self.validated_data.get("reason", ""),
            created_by=self.context["request"].user,
        )
