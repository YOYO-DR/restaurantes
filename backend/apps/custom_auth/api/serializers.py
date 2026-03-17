from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.tokens import TokenError

from apps.accounts.models import Role
from apps.accounts.models import UserProfile
from apps.accounts.models import UserRole
from apps.accounts.models import UserStatus
from apps.restaurants.services import ensure_owner_restaurant

User = get_user_model()


def _get_active_user_status() -> UserStatus:
    status, _ = UserStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activo"},
    )
    return status


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    user_type = serializers.ChoiceField(
        choices=("cliente", "dueno", "owner", "restaurante"),
        required=False,
        default="cliente",
        write_only=True,
    )
    restaurant_name = serializers.CharField(
        max_length=180, required=False, allow_blank=True, write_only=True
    )
    restaurant_address = serializers.CharField(
        max_length=220, required=False, allow_blank=True, write_only=True
    )

    class Meta:
        model = User
        fields = [
            "email",
            "name",
            "phone",
            "password",
            "password_confirm",
            "user_type",
            "restaurant_name",
            "restaurant_address",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )

        user_type = attrs.get("user_type", "cliente")
        if user_type in {"dueno", "owner", "restaurante"}:
            if not attrs.get("restaurant_name", "").strip():
                raise serializers.ValidationError(
                    {"restaurant_name": "Restaurant name is required."}
                )
            if not attrs.get("restaurant_address", "").strip():
                raise serializers.ValidationError(
                    {"restaurant_address": "Restaurant address is required."}
                )

        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        user_type = validated_data.pop("user_type", "cliente")
        phone = validated_data.pop("phone", "")
        restaurant_name = validated_data.pop("restaurant_name", "")
        restaurant_address = validated_data.pop("restaurant_address", "")
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)

        role_code = (
            "restaurante"
            if user_type in {"dueno", "owner", "restaurante"}
            else "cliente"
        )
        role_obj, _ = Role.objects.get_or_create(
            code=role_code,
            defaults={"name": role_code.capitalize()},
        )
        UserRole.objects.get_or_create(user=user, role=role_obj)

        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "status": _get_active_user_status(),
                "phone": phone,
            },
        )
        if phone and profile.phone != phone:
            profile.phone = phone
            profile.save(update_fields=["phone"])

        if role_code == "restaurante":
            ensure_owner_restaurant(
                user,
                business_name=restaurant_name,
                phone=phone,
                address_line1=restaurant_address,
            )

        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        request = self.context.get("request")
        email = attrs.get("email")
        password = attrs.get("password")
        user = authenticate(request=request, email=email, password=password)
        if user is None:
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError("User account is disabled.")
        attrs["user"] = user
        return attrs


class RefreshCookieSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context["request"]
        cookie_name = settings.JWT_REFRESH_COOKIE_NAME
        token = attrs.get("refresh") or request.COOKIES.get(cookie_name)
        if not token:
            raise serializers.ValidationError("Refresh token not provided.")
        attrs["refresh"] = token
        return attrs


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        request = self.context["request"]
        cookie_name = settings.JWT_REFRESH_COOKIE_NAME
        token = attrs.get("refresh") or request.COOKIES.get(cookie_name)
        if not token:
            raise serializers.ValidationError("Refresh token not provided.")
        attrs["refresh"] = token
        return attrs


class UserMeSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "name", "is_active", "role"]

    def get_role(self, obj):
        user_role = (
            UserRole.objects.select_related("role")
            .filter(user=obj)
            .order_by("created_at")
            .first()
        )
        return user_role.role.code if user_role else "cliente"


def build_token_payload(user):
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


def validate_refresh_token(token_str):
    try:
        token = RefreshToken(token_str)
    except TokenError as exc:
        raise serializers.ValidationError("Invalid refresh token.") from exc
    return token


def get_user_from_refresh_token(refresh_token):
    user_id = refresh_token.get("user_id")
    if not user_id:
        raise serializers.ValidationError("Invalid refresh token payload.")

    try:
        return User.objects.get(id=user_id)
    except User.DoesNotExist as exc:
        raise serializers.ValidationError("User not found for refresh token.") from exc
