from rest_framework import serializers

from apps.customers.models import AddressType
from apps.customers.models import CustomerAddress
from apps.customers.models import CustomerPaymentMethod
from apps.customers.models import Favorite


class CustomerAddressSerializer(serializers.ModelSerializer):
    address_type_code = serializers.CharField(
        source="address_type.code",
        read_only=True,
    )
    address_type = serializers.PrimaryKeyRelatedField(
        queryset=AddressType.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = CustomerAddress
        fields = [
            "id",
            "label",
            "line1",
            "line2",
            "city",
            "state",
            "country",
            "notes",
            "is_default",
            "address_type",
            "address_type_code",
        ]
        read_only_fields = ["id"]

    def validate_address_type(self, value: AddressType) -> AddressType:
        if not value.is_active:
            raise serializers.ValidationError(
                "El tipo de direccion no esta disponible.",
            )
        return value

    def create(self, validated_data):
        request = self.context["request"]
        if not validated_data.get("address_type"):
            validated_data["address_type"], _ = AddressType.objects.get_or_create(
                code="home",
                defaults={"name": "Casa", "is_active": True},
            )
        if validated_data.get("is_default"):
            CustomerAddress.objects.filter(user=request.user).update(is_default=False)
        return CustomerAddress.objects.create(user=request.user, **validated_data)

    def update(self, instance, validated_data):
        if validated_data.get("is_default"):
            CustomerAddress.objects.filter(user=instance.user).exclude(
                pk=instance.pk,
            ).update(is_default=False)
        return super().update(instance, validated_data)


class FavoriteSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(
        source="restaurant.display_name",
        read_only=True,
    )
    restaurant_slug = serializers.CharField(source="restaurant.slug", read_only=True)
    restaurant_category = serializers.CharField(
        source="restaurant.category.name",
        read_only=True,
    )
    restaurant_rating = serializers.CharField(
        source="restaurant.average_rating",
        read_only=True,
    )
    restaurant_reviews = serializers.IntegerField(
        source="restaurant.total_reviews",
        read_only=True,
    )
    restaurant_is_open = serializers.SerializerMethodField()
    restaurant_has_delivery = serializers.BooleanField(
        source="restaurant.order_capability.delivery_enabled",
        read_only=True,
    )
    estimated_min_minutes = serializers.IntegerField(
        source="restaurant.delivery_setting.estimated_min_minutes",
        allow_null=True,
        read_only=True,
    )
    estimated_max_minutes = serializers.IntegerField(
        source="restaurant.delivery_setting.estimated_max_minutes",
        allow_null=True,
        read_only=True,
    )

    class Meta:
        model = Favorite
        fields = [
            "id",
            "restaurant",
            "restaurant_name",
            "restaurant_slug",
            "restaurant_category",
            "restaurant_rating",
            "restaurant_reviews",
            "restaurant_is_open",
            "restaurant_has_delivery",
            "estimated_min_minutes",
            "estimated_max_minutes",
        ]

    def get_restaurant_is_open(self, obj: Favorite) -> bool:
        return obj.restaurant.status.code == "active"


class CustomerPaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerPaymentMethod
        fields = [
            "id",
            "masked_number",
            "brand",
            "expires_at",
            "is_default",
        ]


class CustomerPaymentMethodWriteSerializer(serializers.Serializer):
    brand = serializers.CharField(max_length=40, allow_blank=True, required=False)
    masked_number = serializers.CharField(max_length=30)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    is_default = serializers.BooleanField(required=False, default=False)
