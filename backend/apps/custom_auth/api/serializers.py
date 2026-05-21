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
    role = serializers.ChoiceField(
        choices=("customer", "restaurant_owner", "driver"),
        required=False,
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
            "role",
            "restaurant_name",
            "restaurant_address",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."},
            )

        role = attrs.get("role")
        if role == "restaurant_owner":
            attrs["user_type"] = "restaurante"
        elif role == "driver":
            attrs["user_type"] = "cliente"

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
        validated_data.pop("role", None)
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
    is_customer = serializers.SerializerMethodField()
    is_restaurant_owner = serializers.SerializerMethodField()
    is_admin_staff = serializers.SerializerMethodField()
    is_driver = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    birth_date = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    timezone = serializers.SerializerMethodField()
    email_verified = serializers.SerializerMethodField()
    prefers_push = serializers.SerializerMethodField()
    prefers_email = serializers.SerializerMethodField()
    prefers_sms = serializers.SerializerMethodField()
    prefers_marketing = serializers.SerializerMethodField()
    date_joined = serializers.SerializerMethodField()
    last_activity_at = serializers.SerializerMethodField()
    operator_permissions = serializers.SerializerMethodField()
    subscription = serializers.SerializerMethodField()

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
            "is_customer",
            "is_restaurant_owner",
            "is_admin_staff",
            "is_driver",
            "phone",
            "avatar_url",
            "birth_date",
            "language",
            "timezone",
            "email_verified",
            "prefers_push",
            "prefers_email",
            "prefers_sms",
            "prefers_marketing",
            "date_joined",
            "last_activity_at",
            "operator_permissions",
            "subscription",
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

    def _has_role(self, obj, code):
        return code in get_user_role_codes(obj)

    def get_is_customer(self, obj):
        return self._has_role(obj, "cliente")

    def get_is_restaurant_owner(self, obj):
        return self._has_role(obj, "restaurante")

    def get_is_admin_staff(self, obj):
        return self._has_role(obj, "admin")

    def get_is_driver(self, obj):
        return self._has_role(obj, "repartidor")

    def get_phone(self, obj):
        try:
            profile = obj.profile
            return profile.phone or ""
        except Exception:
            return ""

    def get_avatar_url(self, obj):
        try:
            profile = obj.profile
            return profile.avatar_url or ""
        except Exception:
            return ""

    def get_birth_date(self, obj):
        return None

    def get_language(self, obj):
        try:
            profile = obj.profile
            return profile.preferred_language or "es"
        except Exception:
            return "es"

    def get_timezone(self, obj):
        return "America/Bogota"

    def get_email_verified(self, obj):
        return obj.is_active

    def get_prefers_push(self, obj):
        return True

    def get_prefers_email(self, obj):
        return True

    def get_prefers_sms(self, obj):
        return False

    def get_prefers_marketing(self, obj):
        return True

    def get_date_joined(self, obj):
        return obj.date_joined.isoformat() if obj.date_joined else ""

    def get_last_activity_at(self, obj):
        return obj.last_login.isoformat() if obj.last_login else None

    def get_operator_permissions(self, obj):
        operador = getattr(obj, "operador", None)
        if not operador:
            return None
        perms = operador.permissions.all()
        return {
            p.module: {
                "can_view": p.can_view,
                "can_create": p.can_create,
                "can_edit": p.can_edit,
                "can_delete": p.can_delete,
            }
            for p in perms
        }

    def get_subscription(self, obj):
        from apps.core.permissions import is_admin_user, is_owner_user, is_operator_user, get_operator_restaurant_id
        from apps.billing.models import RestaurantSubscription
        from apps.billing.services.features import serialize_features_for_jwt

        if is_admin_user(obj):
            return None

        if is_owner_user(obj):
            restaurant = obj.owned_restaurants.first()
        elif is_operator_user(obj):
            rid = get_operator_restaurant_id(obj)
            if not rid:
                return None
            from apps.restaurants.models import Restaurant
            restaurant = Restaurant.objects.filter(pk=rid).first()
        else:
            return None

        if restaurant is None:
            return None

        try:
            sub = RestaurantSubscription.objects.select_related("plan").get(restaurant=restaurant)
        except RestaurantSubscription.DoesNotExist:
            return None

        features = serialize_features_for_jwt(restaurant.pk)
        return {
            "restaurant_id": str(restaurant.pk),
            "plan": sub.plan.code,
            "plan_name": sub.plan.name,
            "status": sub.status,
            "trial_end": sub.trial_end.isoformat() if sub.trial_end else None,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "cancelled_at": sub.cancelled_at.isoformat() if sub.cancelled_at else None,
            "features": features,
        }


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
