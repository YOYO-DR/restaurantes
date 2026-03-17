from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import UserProfile
from apps.accounts.models import UserStatus

User = get_user_model()


class AccountProfileSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, allow_blank=True, required=False)
    avatar_url = serializers.URLField(allow_blank=True, required=False)

    def to_representation(self, instance):
        profile = getattr(instance, "profile", None)
        return {
            "id": str(instance.id),
            "name": instance.name,
            "email": instance.email,
            "phone": profile.phone if profile else "",
            "avatar_url": profile.avatar_url if profile else "",
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
        profile.avatar_url = validated_data.get("avatar_url", profile.avatar_url)
        profile.save(update_fields=["phone", "avatar_url"])
        return instance
