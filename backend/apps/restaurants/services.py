from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.text import slugify

from apps.platform_config.models import BillingPeriod
from apps.platform_config.models import SubscriptionPlan
from apps.restaurants.models import CartPosition
from apps.restaurants.models import CategoryNavigationStyle
from apps.restaurants.models import MenuLayoutOption
from apps.restaurants.models import OPERATOR_MODULES
from apps.restaurants.models import Operador
from apps.restaurants.models import OperatorInvitation
from apps.restaurants.models import OperatorPermission
from apps.restaurants.models import QrCode
from apps.restaurants.models import QrTargetType
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantAddress
from apps.restaurants.models import RestaurantBranding
from apps.restaurants.models import RestaurantCategory
from apps.restaurants.models import RestaurantDeliverySetting
from apps.restaurants.models import RestaurantHour
from apps.restaurants.models import RestaurantOrderCapability
from apps.restaurants.models import RestaurantStatus
from apps.restaurants.models import RestaurantTable
from apps.restaurants.models import TableStatus

DEFAULT_OPERATOR_PERMISSIONS: dict[str, dict[str, bool]] = {
    "pedidos":        {"can_view": True,  "can_create": False, "can_edit": True,  "can_delete": False},
    "menu":           {"can_view": True,  "can_create": True,  "can_edit": True,  "can_delete": False},
    "inventario":     {"can_view": True,  "can_create": False, "can_edit": False, "can_delete": False},
    "clientes":       {"can_view": True,  "can_create": False, "can_edit": False, "can_delete": False},
    "lealtad":        {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    "resenas":        {"can_view": True,  "can_create": False, "can_edit": True,  "can_delete": False},
    "analiticas":     {"can_view": True,  "can_create": False, "can_edit": False, "can_delete": False},
    "qr":             {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    "personalizacion":{"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    "configuracion":  {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
}


def create_default_operator_permissions(operator: Operador) -> None:
    for module in OPERATOR_MODULES:
        defaults = DEFAULT_OPERATOR_PERMISSIONS.get(module, {"can_view": True})
        OperatorPermission.objects.get_or_create(
            operator=operator,
            module=module,
            defaults=defaults,
        )


def build_permissions_snapshot_from_request(permissions_data: dict) -> dict:
    """Normaliza el snapshot de permisos garantizando que todos los módulos estén presentes."""
    snapshot = {}
    for module in OPERATOR_MODULES:
        module_perms = permissions_data.get(module, DEFAULT_OPERATOR_PERMISSIONS.get(module, {}))
        snapshot[module] = {
            "can_view": bool(module_perms.get("can_view", True)),
            "can_create": bool(module_perms.get("can_create", False)),
            "can_edit": bool(module_perms.get("can_edit", False)),
            "can_delete": bool(module_perms.get("can_delete", False)),
        }
    return snapshot


def send_operator_invitation_email(invitation: OperatorInvitation) -> None:
    base_url = getattr(settings, "FRONTEND_URL", "http://localhost:5174").rstrip("/")
    accept_url = f"{base_url}/invitacion-operador/{invitation.token}"

    context = {
        "restaurant_name": invitation.restaurant.display_name,
        "invited_by_name": getattr(invitation.invited_by, "name", "") or invitation.restaurant.display_name,
        "accept_url": accept_url,
        "email": invitation.email,
    }

    subject = f"Invitacion para unirte a {invitation.restaurant.display_name} en FoodHub"
    text_body = render_to_string("restaurants/operator_invitation_email.txt", context)
    html_body = render_to_string("restaurants/operator_invitation_email.html", context)
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@foodhub.local")

    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[invitation.email],
    )
    message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=True)


def _build_unique_restaurant_slug(base_value: str) -> str:
    base_slug = slugify(base_value)[:140] or "restaurante"
    candidate = base_slug
    suffix = 2

    while Restaurant.objects.filter(slug=candidate).exists():
        candidate = f"{base_slug[:150]}-{suffix}"[:160]
        suffix += 1

    return candidate


def _ensure_default_schedule(restaurant: Restaurant) -> None:
    for weekday in range(7):
        RestaurantHour.objects.get_or_create(
            restaurant=restaurant,
            weekday=weekday,
            defaults={
                "open_time": "09:00",
                "close_time": "18:00",
                "is_closed": weekday == 6,
            },
        )


def ensure_owner_restaurant(
    user,
    *,
    business_name: str = "",
    phone: str = "",
    address_line1: str = "",
) -> Restaurant:
    existing_restaurant = user.owned_restaurants.order_by("created_at").first()
    if existing_restaurant:
        if business_name and existing_restaurant.display_name != business_name:
            existing_restaurant.display_name = business_name[:180]
        if phone and existing_restaurant.phone != phone:
            existing_restaurant.phone = phone
        if existing_restaurant.email != user.email:
            existing_restaurant.email = user.email
        if not existing_restaurant.currency_code:
            existing_restaurant.currency_code = "COP"
        existing_restaurant.save(
            update_fields=["display_name", "phone", "email", "currency_code"],
        )

        if address_line1:
            address, _ = RestaurantAddress.objects.get_or_create(
                restaurant=existing_restaurant,
                is_primary=True,
                defaults={
                    "line1": address_line1,
                    "city": "",
                    "country": "Colombia",
                },
            )
            address.line1 = address_line1
            if not address.country:
                address.country = "Colombia"
            address.save(update_fields=["line1", "country"])

        RestaurantOrderCapability.objects.get_or_create(restaurant=existing_restaurant)
        RestaurantDeliverySetting.objects.get_or_create(restaurant=existing_restaurant)
        _ensure_default_schedule(existing_restaurant)
        ensure_restaurant_branding(existing_restaurant)
        return existing_restaurant

    billing_period, _ = BillingPeriod.objects.get_or_create(
        code="monthly",
        defaults={"name": "Mensual"},
    )
    subscription_plan, _ = SubscriptionPlan.objects.get_or_create(
        code="starter",
        defaults={
            "name": "Starter",
            "billing_period": billing_period,
            "price_amount": "0.00",
            "currency_code": "COP",
        },
    )
    category, _ = RestaurantCategory.objects.get_or_create(
        code="general",
        defaults={"name": "General"},
    )
    status, _ = RestaurantStatus.objects.get_or_create(
        code="active",
        defaults={"name": "Activo"},
    )

    restaurant_name = (
        business_name.strip() or (user.name or "").strip() or user.email.split("@")[0]
    )
    display_name = restaurant_name[:180]

    restaurant = Restaurant.objects.create(
        owner=user,
        category=category,
        subscription_plan=subscription_plan,
        status=status,
        slug=_build_unique_restaurant_slug(display_name),
        display_name=display_name,
        email=user.email,
        phone=phone,
        currency_code="COP",
    )

    if address_line1:
        RestaurantAddress.objects.create(
            restaurant=restaurant,
            line1=address_line1,
            city="",
            country="Colombia",
            is_primary=True,
        )

    RestaurantOrderCapability.objects.get_or_create(restaurant=restaurant)
    RestaurantDeliverySetting.objects.get_or_create(restaurant=restaurant)
    _ensure_default_schedule(restaurant)
    ensure_restaurant_branding(restaurant)

    return restaurant


def ensure_qr_catalogs() -> None:
    QrTargetType.objects.get_or_create(code="menu", defaults={"name": "Menu"})
    QrTargetType.objects.get_or_create(code="table", defaults={"name": "Mesa"})
    TableStatus.objects.get_or_create(code="active", defaults={"name": "Activa"})
    TableStatus.objects.get_or_create(code="inactive", defaults={"name": "Inactiva"})


def ensure_branding_catalogs() -> None:
    MenuLayoutOption.objects.get_or_create(
        code="cards",
        defaults={"name": "Tarjetas con imagen"},
    )
    MenuLayoutOption.objects.get_or_create(
        code="list",
        defaults={"name": "Lista compacta"},
    )
    MenuLayoutOption.objects.get_or_create(code="grid", defaults={"name": "Cuadricula"})
    CategoryNavigationStyle.objects.get_or_create(
        code="tabs",
        defaults={"name": "Pestanas horizontales"},
    )
    CategoryNavigationStyle.objects.get_or_create(
        code="sidebar",
        defaults={"name": "Barra lateral"},
    )
    CategoryNavigationStyle.objects.get_or_create(
        code="dropdown",
        defaults={"name": "Menu desplegable"},
    )
    CartPosition.objects.get_or_create(
        code="sidebar",
        defaults={"name": "Barra lateral"},
    )
    CartPosition.objects.get_or_create(
        code="bottom",
        defaults={"name": "Barra inferior"},
    )
    CartPosition.objects.get_or_create(
        code="floating",
        defaults={"name": "Boton flotante"},
    )


def ensure_restaurant_branding(restaurant: Restaurant) -> RestaurantBranding:
    ensure_branding_catalogs()
    menu_layout = MenuLayoutOption.objects.get(code="cards")
    category_navigation = CategoryNavigationStyle.objects.get(code="tabs")
    cart_position = CartPosition.objects.get(code="sidebar")

    branding, _ = RestaurantBranding.objects.get_or_create(
        restaurant=restaurant,
        defaults={
            "menu_layout_option": menu_layout,
            "category_navigation_style": category_navigation,
            "cart_position": cart_position,
            "primary_color": "#e85d04",
            "secondary_color": "#16a34a",
        },
    )

    return branding


def build_menu_qr_url(base_url: str, restaurant: Restaurant) -> str:
    return f"{base_url}/restaurantes/{restaurant.slug}"


def build_table_qr_url(
    base_url: str,
    restaurant: Restaurant,
    table: RestaurantTable,
) -> str:
    return f"{base_url}/restaurantes/{restaurant.slug}?table={table.table_number}"


def ensure_menu_qr_code(base_url: str, restaurant: Restaurant) -> QrCode:
    ensure_qr_catalogs()
    target_type = QrTargetType.objects.get(code="menu")
    qr_code, _ = QrCode.objects.get_or_create(
        restaurant=restaurant,
        target_type=target_type,
        target_id=None,
        defaults={"qr_url": build_menu_qr_url(base_url, restaurant), "is_active": True},
    )
    qr_code.qr_url = build_menu_qr_url(base_url, restaurant)
    qr_code.is_active = True
    qr_code.save(update_fields=["qr_url", "is_active", "updated_at"])
    return qr_code


def ensure_table_qr_code(
    base_url: str,
    restaurant: Restaurant,
    table: RestaurantTable,
) -> QrCode:
    ensure_qr_catalogs()
    target_type = QrTargetType.objects.get(code="table")
    qr_code, _ = QrCode.objects.get_or_create(
        restaurant=restaurant,
        target_type=target_type,
        target_id=table.id,
        defaults={
            "qr_url": build_table_qr_url(base_url, restaurant, table),
            "is_active": table.status.code == "active",
        },
    )
    qr_code.qr_url = build_table_qr_url(base_url, restaurant, table)
    qr_code.is_active = table.status.code == "active"
    qr_code.save(update_fields=["qr_url", "is_active", "updated_at"])
    return qr_code
