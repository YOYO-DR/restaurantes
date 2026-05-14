from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import UserProfile
from apps.accounts.models import UserStatus
from apps.platform_config.models import BackupFrequency
from apps.platform_config.models import PlatformSecuritySetting
from apps.platform_config.models import PlatformSetting
from apps.platform_config.models import SubscriptionPlan
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantCategory
from apps.restaurants.models import RestaurantDeliverySetting
from apps.restaurants.models import RestaurantOrderCapability
from apps.restaurants.models import RestaurantStatus

User = get_user_model()


class AccountProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, allow_blank=True, required=False)
    avatar_url = serializers.URLField(allow_blank=True, required=False)
    avatar_file = serializers.FileField(required=False, allow_null=True, write_only=True)
    remove_avatar = serializers.BooleanField(required=False, write_only=True)

    def _resolve_avatar_url(self, profile) -> str:
        if not profile:
            return ""
        request = self.context.get("request")
        if profile.avatar_file:
            file_url = profile.avatar_file.url
            if request and file_url.startswith("/"):
                return request.build_absolute_uri(file_url)
            return file_url
        return profile.avatar_url or ""

    def to_representation(self, instance):
        profile = getattr(instance, "profile", None)
        return {
            "id": str(instance.id),
            "name": instance.name,
            "email": instance.email,
            "phone": profile.phone if profile else "",
            "avatar_url": self._resolve_avatar_url(profile),
        }

    def update(self, instance, validated_data):
        instance.name = validated_data.get("name", instance.name)
        instance.email = validated_data.get("email", instance.email)
        instance.save(update_fields=["name", "email"])

        profile, _ = UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                "status": UserStatus.objects.get_or_create(
                    code="active",
                    defaults={"name": "Activo"},
                )[0],
            },
        )
        profile.phone = validated_data.get("phone", profile.phone)

        if validated_data.get("remove_avatar"):
            profile.avatar_file = None
            profile.avatar_url = ""
        elif validated_data.get("avatar_file"):
            profile.avatar_file = validated_data["avatar_file"]
            profile.avatar_url = ""
        elif "avatar_url" in validated_data:
            profile.avatar_url = validated_data["avatar_url"]

        profile.save(update_fields=["phone", "avatar_url", "avatar_file"])
        return instance


class AdminPlatformSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformSetting
        fields = [
            "platform_name",
            "support_email",
            "support_phone",
            "support_address",
            "default_currency_code",
            "default_locale",
            "maintenance_mode",
        ]


class AdminPlatformSecuritySettingSerializer(serializers.ModelSerializer):
    backup_frequency = serializers.SlugRelatedField(
        slug_field="code",
        queryset=BackupFrequency.objects.filter(is_active=True),
    )
    backup_frequency_label = serializers.CharField(
        source="backup_frequency.name",
        read_only=True,
    )

    class Meta:
        model = PlatformSecuritySetting
        fields = [
            "require_2fa_admin",
            "require_restaurant_verification",
            "encrypt_payment_data",
            "backup_frequency",
            "backup_frequency_label",
            "backup_retention_days",
        ]


class AdminRestaurantSerializer(serializers.ModelSerializer):
    category = serializers.SlugRelatedField(
        slug_field="code",
        queryset=RestaurantCategory.objects.filter(is_active=True),
    )
    status = serializers.SlugRelatedField(
        slug_field="code",
        queryset=RestaurantStatus.objects.filter(is_active=True),
    )
    subscription_plan = serializers.SlugRelatedField(
        slug_field="code",
        queryset=SubscriptionPlan.objects.filter(is_active=True),
    )
    delivery_enabled = serializers.BooleanField(required=False)
    pickup_enabled = serializers.BooleanField(required=False)
    table_order_enabled = serializers.BooleanField(required=False)
    delivery_fee_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
    )
    min_order_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        allow_null=True,
        required=False,
    )
    estimated_min_minutes = serializers.IntegerField(allow_null=True, required=False)
    estimated_max_minutes = serializers.IntegerField(allow_null=True, required=False)

    class Meta:
        model = Restaurant
        fields = [
            "display_name",
            "slug",
            "legal_name",
            "nit",
            "email",
            "phone",
            "currency_code",
            "description",
            "category",
            "status",
            "subscription_plan",
            "delivery_enabled",
            "pickup_enabled",
            "table_order_enabled",
            "delivery_fee_amount",
            "min_order_amount",
            "estimated_min_minutes",
            "estimated_max_minutes",
        ]

    def to_representation(self, instance):
        capability = getattr(instance, "order_capability", None)
        delivery_setting = getattr(instance, "delivery_setting", None)
        return {
            "display_name": instance.display_name,
            "slug": instance.slug,
            "legal_name": instance.legal_name,
            "nit": instance.nit,
            "email": instance.email,
            "phone": instance.phone,
            "currency_code": instance.currency_code,
            "description": instance.description,
            "category": instance.category.code,
            "status": instance.status.code,
            "subscription_plan": instance.subscription_plan.code,
            "delivery_enabled": capability.delivery_enabled if capability else False,
            "pickup_enabled": capability.pickup_enabled if capability else False,
            "table_order_enabled": capability.table_order_enabled
            if capability
            else False,
            "delivery_fee_amount": str(
                delivery_setting.delivery_fee_amount if delivery_setting else "0.00",
            ),
            "min_order_amount": (
                str(delivery_setting.min_order_amount)
                if delivery_setting and delivery_setting.min_order_amount is not None
                else None
            ),
            "estimated_min_minutes": (
                delivery_setting.estimated_min_minutes if delivery_setting else None
            ),
            "estimated_max_minutes": (
                delivery_setting.estimated_max_minutes if delivery_setting else None
            ),
        }

    def update(self, instance, validated_data):
        capability_fields = {
            key: validated_data.pop(key)
            for key in ["delivery_enabled", "pickup_enabled", "table_order_enabled"]
            if key in validated_data
        }
        delivery_fields = {
            key: validated_data.pop(key)
            for key in [
                "delivery_fee_amount",
                "min_order_amount",
                "estimated_min_minutes",
                "estimated_max_minutes",
            ]
            if key in validated_data
        }

        for field, value in validated_data.items():
            setattr(instance, field, value)
        update_fields = list(validated_data.keys())
        if update_fields:
            instance.save(update_fields=update_fields)

        capability, _ = RestaurantOrderCapability.objects.get_or_create(
            restaurant=instance,
        )
        if capability_fields:
            for field, value in capability_fields.items():
                setattr(capability, field, value)
            capability.save(update_fields=list(capability_fields.keys()))

        delivery_setting, _ = RestaurantDeliverySetting.objects.get_or_create(
            restaurant=instance,
        )
        if delivery_fields:
            for field, value in delivery_fields.items():
                setattr(delivery_setting, field, value)
            delivery_setting.save(update_fields=list(delivery_fields.keys()))

        return instance
