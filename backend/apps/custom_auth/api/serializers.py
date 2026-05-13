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
ROLE_PRIORITY = {
    "admin": 0,
    "restaurante": 1,
    "operador": 2,
    "cliente": 3,
}


def _get_active_user_status() -> UserStatus:
    status, _ = UserStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activo"},
    )
    return status


def _get_or_create_role(code: str, name: str | None = None) -> Role:
    role, _ = Role.objects.get_or_create(
        code=code,
        defaults={"name": name or code.capitalize()},
    )
    return role


def _ensure_companion_customer_role(user) -> None:
    existing_codes = set(
        UserRole.objects.filter(user=user).values_list("role__code", flat=True),
    )
    if (
        existing_codes.intersection({"admin", "restaurante", "operador"})
        and "cliente" not in existing_codes
    ):
        UserRole.objects.get_or_create(
            user=user,
            role=_get_or_create_role("cliente", "Cliente"),
        )


def get_user_role_codes(user) -> list[str]:
    _ensure_companion_customer_role(user)
    role_codes = list(
        UserRole.objects.filter(user=user)
        .select_related("role")
        .values_list("role__code", flat=True),
    )
    if not role_codes:
        return ["cliente"]
    return sorted(set(role_codes), key=lambda code: (ROLE_PRIORITY.get(code, 99), code))


def get_primary_role(user) -> str:
    return get_user_role_codes(user)[0]


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
        max_length=180,
        required=False,
        allow_blank=True,
        write_only=True,
    )
    restaurant_address = serializers.CharField(
        max_length=220,
        required=False,
        allow_blank=True,
        write_only=True,
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
                {"password_confirm": "Passwords do not match."},
            )

        user_type = attrs.get("user_type", "cliente")
        if user_type in {"dueno", "owner", "restaurante"}:
            if not attrs.get("restaurant_name", "").strip():
                raise serializers.ValidationError(
                    {"restaurant_name": "Restaurant name is required."},
                )
            if not attrs.get("restaurant_address", "").strip():
                raise serializers.ValidationError(
                    {"restaurant_address": "Restaurant address is required."},
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

        UserRole.objects.get_or_create(
            user=user,
            role=_get_or_create_role("cliente", "Cliente"),
        )

        role_code = "cliente"
        if user_type in {"dueno", "owner", "restaurante"}:
            role_code = "restaurante"
            UserRole.objects.get_or_create(
                user=user,
                role=_get_or_create_role("restaurante", "Restaurante"),
            )

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
    roles = serializers.SerializerMethodField()
    available_roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "is_active",
            "role",
            "roles",
            "available_roles",
        ]

    def get_role(self, obj):
        return get_primary_role(obj)

    def get_roles(self, obj):
        return get_user_role_codes(obj)

    def get_available_roles(self, obj):
        labels = {
            "cliente": "Cliente",
            "restaurante": "Dueno de restaurante",
            "operador": "Operador",
            "admin": "Administrador",
        }
        return [
            {"code": code, "label": labels.get(code, code.capitalize())}
            for code in get_user_role_codes(obj)
        ]


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
