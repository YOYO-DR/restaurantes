from datetime import date
from datetime import timedelta
from math import ceil

from django.contrib.auth import get_user_model
from django.db.models import Case
from django.db.models import Count
from django.db.models import Exists
from django.db.models import IntegerField
from django.db.models import Max
from django.db.models import OuterRef
from django.db.models import Q
from django.db.models import Sum
from django.db.models import Value
from django.db.models import When
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.accounts.api.serializers import AdminRestaurantSerializer
from apps.accounts.api.serializers import AdminPlatformSecuritySettingSerializer
from apps.accounts.api.serializers import AdminPlatformSettingSerializer
from apps.accounts.api.serializers import AccountProfileSerializer
from apps.accounts.models import UserRole
from apps.core.permissions import IsAdminRole
from apps.core.permissions import IsAuthenticatedUser
from apps.orders.models import Order
from apps.orders.services import filter_orders_by_scope
from apps.platform_config.models import BackupFrequency
from apps.platform_config.models import BillingPeriod
from apps.platform_config.models import PlatformSecuritySetting
from apps.platform_config.models import PlatformSetting
from apps.platform_config.models import SubscriptionPlan
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantCategory
from apps.restaurants.models import RestaurantReview
from apps.restaurants.models import RestaurantStatus


User = get_user_model()
MONTH_LABELS = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
]


def to_float(value) -> float:
    return round(float(value or 0), 2)


def calculate_growth(current: float, previous: float) -> int:
    if previous <= 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100)


def shift_month(value: date, months: int) -> date:
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def get_or_create_platform_setting() -> PlatformSetting:
    return PlatformSetting.objects.order_by(
        "created_at"
    ).first() or PlatformSetting.objects.create(
        platform_name="FoodHub",
        support_email="support@foodhub.com",
        support_phone="",
        support_address="",
        default_currency_code="COP",
        default_locale="es-CO",
        maintenance_mode=False,
    )


def get_or_create_platform_security_setting() -> PlatformSecuritySetting:
    backup_frequency, _ = BackupFrequency.objects.get_or_create(
        code="daily",
        defaults={"name": "Diaria"},
    )
    return PlatformSecuritySetting.objects.order_by(
        "created_at"
    ).first() or PlatformSecuritySetting.objects.create(
        require_2fa_admin=False,
        require_restaurant_verification=True,
        encrypt_payment_data=True,
        backup_frequency=backup_frequency,
        backup_retention_days=30,
    )


def get_user_role_code(user) -> str:
    user_role = user.account_roles.select_related("role").order_by("created_at").first()
    return user_role.role.code if user_role else "cliente"


def get_user_status_label(user) -> str:
    profile = getattr(user, "profile", None)
    if profile and profile.status:
        return profile.status.name
    return "Activo" if user.is_active else "Inactivo"


def get_user_status_code(user) -> str:
    profile = getattr(user, "profile", None)
    if profile and profile.status:
        return profile.status.code
    return "active" if user.is_active else "inactive"


class AccountProfileViewSet(GenericViewSet):
    permission_classes = [IsAuthenticatedUser]
    serializer_class = AccountProfileSerializer

    def list(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.get_serializer(request.user).data)


class AdminDashboardViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def list(self, request):
        order_scope = request.query_params.get("order_scope", "all").strip()
        today = timezone.localdate()
        now = timezone.now()
        current_period_start = today - timedelta(days=29)
        previous_period_start = current_period_start - timedelta(days=30)
        previous_period_end = current_period_start - timedelta(days=1)

        users_total = User.objects.count()
        users_current = User.objects.filter(
            date_joined__date__gte=current_period_start
        ).count()
        users_previous = User.objects.filter(
            date_joined__date__range=(previous_period_start, previous_period_end)
        ).count()

        active_restaurants = Restaurant.objects.filter(status__code="active").count()
        restaurants_current = Restaurant.objects.filter(
            created_at__date__gte=current_period_start
        ).count()
        restaurants_previous = Restaurant.objects.filter(
            created_at__date__range=(previous_period_start, previous_period_end)
        ).count()

        base_orders_queryset = filter_orders_by_scope(Order.objects.all(), order_scope)
        orders_total = base_orders_queryset.count()
        current_orders_queryset = filter_orders_by_scope(
            Order.objects.filter(created_at__date__gte=current_period_start),
            order_scope,
        )
        previous_orders_queryset = filter_orders_by_scope(
            Order.objects.filter(
                created_at__date__range=(previous_period_start, previous_period_end)
            ),
            order_scope,
        )
        orders_current = current_orders_queryset.count()
        orders_previous = previous_orders_queryset.count()
        revenue_total = (
            base_orders_queryset.aggregate(total=Sum("total_amount"))["total"] or 0
        )
        revenue_current = (
            current_orders_queryset.aggregate(total=Sum("total_amount"))["total"] or 0
        )
        revenue_previous = (
            previous_orders_queryset.aggregate(total=Sum("total_amount"))["total"] or 0
        )

        monthly_performance = []
        month_anchor = today.replace(day=1)
        for offset in range(5, -1, -1):
            current_month = shift_month(month_anchor, -offset)
            month_orders_queryset = filter_orders_by_scope(
                Order.objects.filter(
                    created_at__year=current_month.year,
                    created_at__month=current_month.month,
                ),
                order_scope,
            )
            month_revenue = (
                month_orders_queryset.aggregate(total=Sum("total_amount"))["total"] or 0
            )
            monthly_performance.append(
                {
                    "month": MONTH_LABELS[current_month.month - 1],
                    "orders": month_orders_queryset.count(),
                    "revenue": to_float(month_revenue),
                }
            )

        category_distribution_rows = list(
            Restaurant.objects.values("category__name")
            .annotate(value=Count("id"))
            .order_by("-value", "category__name")[:6]
        )
        category_distribution = [
            {
                "name": row["category__name"] or "Sin categoria",
                "value": row["value"],
            }
            for row in category_distribution_rows
        ]

        role_distribution_rows = list(
            User.objects.annotate(
                admin_roles=Count(
                    "account_roles",
                    filter=Q(account_roles__role__code="admin"),
                    distinct=True,
                ),
                owner_roles=Count(
                    "account_roles",
                    filter=Q(account_roles__role__code="restaurante"),
                    distinct=True,
                ),
            ).values("admin_roles", "owner_roles")
        )
        total_admins = sum(1 for row in role_distribution_rows if row["admin_roles"])
        total_owners = sum(1 for row in role_distribution_rows if row["owner_roles"])
        role_distribution = [
            {
                "code": "cliente",
                "label": "Clientes",
                "count": max(users_total - total_admins - total_owners, 0),
            },
            {"code": "restaurante", "label": "Restaurantes", "count": total_owners},
            {"code": "admin", "label": "Admins", "count": total_admins},
        ]

        delayed_orders_queryset = filter_orders_by_scope(
            Order.objects.filter(
                status__code__in=["new", "preparing"],
                created_at__lte=now - timedelta(hours=2),
            ),
            order_scope,
        )
        delayed_orders_count = delayed_orders_queryset.count()
        delayed_restaurants = list(
            Restaurant.objects.filter(orders__in=delayed_orders_queryset)
            .values_list("display_name", flat=True)
            .distinct()
            .order_by("display_name")[:3]
        )
        pending_review_replies = RestaurantReview.objects.filter(owner_reply="").count()
        restaurants_without_menu = (
            Restaurant.objects.annotate(menu_items_count=Count("menu_items"))
            .filter(menu_items_count=0)
            .count()
        )

        alerts = []
        if delayed_orders_count:
            alerts.append(
                {
                    "severity": "high",
                    "title": f"{delayed_orders_count} pedidos siguen abiertos por mas de 2 horas",
                    "description": (
                        "Restaurantes impactados: " + ", ".join(delayed_restaurants)
                        if delayed_restaurants
                        else "Revisa los flujos operativos de los restaurantes con demora."
                    ),
                }
            )
        if pending_review_replies:
            alerts.append(
                {
                    "severity": "medium",
                    "title": f"{pending_review_replies} resenas esperan respuesta del restaurante",
                    "description": "Puede afectar la percepcion de soporte y confianza en la plataforma.",
                }
            )
        if restaurants_without_menu:
            alerts.append(
                {
                    "severity": "low",
                    "title": f"{restaurants_without_menu} restaurantes aun no publican menu",
                    "description": "Son candidatos a onboarding asistido para activar ventas mas rapido.",
                }
            )
        if not alerts:
            alerts.append(
                {
                    "severity": "info",
                    "title": "Sin alertas operativas relevantes",
                    "description": "Los indicadores actuales no muestran bloqueos importantes en la plataforma.",
                }
            )

        top_restaurants_rows = list(
            Restaurant.objects.filter(orders__in=current_orders_queryset)
            .values("id", "display_name", "category__name")
            .annotate(
                total_orders=Count("orders"),
                total_revenue=Sum("orders__total_amount"),
            )
            .order_by("-total_revenue", "-total_orders", "display_name")[:5]
        )

        average_order_value = (
            to_float(revenue_total / orders_total) if orders_total else 0
        )

        return Response(
            {
                "metrics": {
                    "total_users": users_total,
                    "users_growth": calculate_growth(users_current, users_previous),
                    "active_restaurants": active_restaurants,
                    "restaurants_growth": calculate_growth(
                        restaurants_current, restaurants_previous
                    ),
                    "total_orders": orders_total,
                    "orders_growth": calculate_growth(orders_current, orders_previous),
                    "total_revenue": to_float(revenue_total),
                    "revenue_growth": calculate_growth(
                        to_float(revenue_current), to_float(revenue_previous)
                    ),
                },
                "order_scope": order_scope,
                "monthly_performance": monthly_performance,
                "category_distribution": category_distribution,
                "role_distribution": role_distribution,
                "operational_metrics": {
                    "delayed_orders": delayed_orders_count,
                    "pending_review_replies": pending_review_replies,
                    "restaurants_without_menu": restaurants_without_menu,
                    "average_order_value": average_order_value,
                },
                "top_restaurants": [
                    {
                        "id": str(row["id"]),
                        "name": row["display_name"],
                        "category": row["category__name"] or "Sin categoria",
                        "orders": row["total_orders"],
                        "revenue": to_float(row["total_revenue"]),
                    }
                    for row in top_restaurants_rows
                ],
                "alerts": alerts,
            }
        )


class AdminUsersViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def list(self, request):
        admin_role_exists = UserRole.objects.filter(
            user=OuterRef("pk"), role__code="admin"
        )
        owner_role_exists = UserRole.objects.filter(
            user=OuterRef("pk"), role__code="restaurante"
        )
        queryset = (
            User.objects.all()
            .select_related("profile__status")
            .annotate(
                has_admin_role=Exists(admin_role_exists),
                has_owner_role=Exists(owner_role_exists),
                orders_count=Count("orders", distinct=True),
                role_code=Case(
                    When(has_admin_role=True, then=Value("admin")),
                    When(has_owner_role=True, then=Value("restaurante")),
                    default=Value("cliente"),
                ),
                role_sort=Case(
                    When(has_admin_role=True, then=Value(0)),
                    When(has_owner_role=True, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                ),
            )
        )

        name_filter = request.query_params.get("name", "").strip()
        email_filter = request.query_params.get("email", "").strip()
        phone_filter = request.query_params.get("phone", "").strip()
        role_filter = request.query_params.get("role", "").strip()
        status_filter = request.query_params.get("status", "").strip()
        orders_count_filter = request.query_params.get("orders_count", "").strip()
        joined_at_filter = request.query_params.get("joined_at", "").strip()
        ordering = (
            request.query_params.get("ordering", "-joined_at").strip() or "-joined_at"
        )

        try:
            page = max(int(request.query_params.get("page", 1) or 1), 1)
        except ValueError:
            page = 1
        try:
            page_size = min(
                max(int(request.query_params.get("page_size", 10) or 10), 1), 100
            )
        except ValueError:
            page_size = 10

        if name_filter:
            queryset = queryset.filter(name__icontains=name_filter)

        if email_filter:
            queryset = queryset.filter(email__icontains=email_filter)

        if phone_filter:
            queryset = queryset.filter(profile__phone__icontains=phone_filter)

        if role_filter:
            queryset = queryset.filter(role_code=role_filter)

        if status_filter:
            if status_filter == "active":
                queryset = queryset.filter(
                    Q(profile__status__code="active")
                    | Q(profile__isnull=True, is_active=True)
                )
            elif status_filter == "inactive":
                queryset = queryset.filter(
                    Q(profile__status__code="inactive")
                    | Q(profile__isnull=True, is_active=False)
                )
            else:
                queryset = queryset.filter(profile__status__code=status_filter)

        if orders_count_filter:
            try:
                queryset = queryset.filter(orders_count=int(orders_count_filter))
            except ValueError:
                pass

        if joined_at_filter:
            queryset = queryset.filter(date_joined__date=joined_at_filter)

        ordering_map = {
            "name": ["name", "email"],
            "-name": ["-name", "-email"],
            "email": ["email"],
            "-email": ["-email"],
            "phone": ["profile__phone", "email"],
            "-phone": ["-profile__phone", "-email"],
            "role": ["role_sort", "name", "email"],
            "-role": ["-role_sort", "-name", "-email"],
            "status": ["profile__status__name", "is_active", "name"],
            "-status": ["-profile__status__name", "-is_active", "-name"],
            "orders_count": ["orders_count", "name"],
            "-orders_count": ["-orders_count", "-name"],
            "joined_at": ["date_joined", "name"],
            "-joined_at": ["-date_joined", "-name"],
        }
        queryset = queryset.order_by(
            *ordering_map.get(ordering, ordering_map["-joined_at"])
        )

        total_count = queryset.count()
        total_pages = max(ceil(total_count / page_size), 1)
        if page > total_pages:
            page = total_pages
        start = (page - 1) * page_size
        end = start + page_size

        users = []
        for user in queryset[start:end]:
            users.append(
                {
                    "id": str(user.id),
                    "name": user.name or user.email,
                    "email": user.email,
                    "phone": getattr(getattr(user, "profile", None), "phone", ""),
                    "role": user.role_code,
                    "status": get_user_status_code(user),
                    "status_label": get_user_status_label(user),
                    "joined_at": user.date_joined.isoformat(),
                    "orders_count": user.orders_count,
                }
            )

        counts = {
            "total": total_count,
            "clientes": queryset.filter(role_code="cliente").count(),
            "restaurantes": queryset.filter(role_code="restaurante").count(),
            "admins": queryset.filter(role_code="admin").count(),
        }
        return Response(
            {
                "counts": counts,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "ordering": ordering,
                "results": users,
            }
        )


class AdminRestaurantsViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def list(self, request):
        queryset = Restaurant.objects.select_related(
            "owner",
            "owner__profile",
            "owner__profile__status",
            "category",
            "status",
            "subscription_plan",
        ).annotate(
            orders_count=Count("orders"),
            total_revenue=Sum("orders__total_amount"),
            last_order_at=Max("orders__created_at"),
        )

        name_filter = request.query_params.get("name", "").strip()
        owner_filter = request.query_params.get("owner", "").strip()
        category_filter = request.query_params.get("category", "").strip()
        status_filter = request.query_params.get("status", "").strip()
        plan_filter = request.query_params.get("subscription_plan", "").strip()
        orders_count_filter = request.query_params.get("orders_count", "").strip()
        revenue_filter = request.query_params.get("revenue", "").strip()
        joined_at_filter = request.query_params.get("joined_at", "").strip()
        ordering = (
            request.query_params.get("ordering", "-joined_at").strip() or "-joined_at"
        )

        try:
            page = max(int(request.query_params.get("page", 1) or 1), 1)
        except ValueError:
            page = 1
        try:
            page_size = min(
                max(int(request.query_params.get("page_size", 10) or 10), 1), 100
            )
        except ValueError:
            page_size = 10

        if name_filter:
            queryset = queryset.filter(display_name__icontains=name_filter)

        if owner_filter:
            queryset = queryset.filter(
                Q(owner__name__icontains=owner_filter)
                | Q(owner__email__icontains=owner_filter)
            )

        if category_filter:
            queryset = queryset.filter(category__name__icontains=category_filter)

        if status_filter:
            queryset = queryset.filter(status__code=status_filter)

        if plan_filter:
            queryset = queryset.filter(subscription_plan__name__icontains=plan_filter)

        if orders_count_filter:
            try:
                queryset = queryset.filter(orders_count=int(orders_count_filter))
            except ValueError:
                pass

        if revenue_filter:
            try:
                queryset = queryset.filter(total_revenue=float(revenue_filter))
            except ValueError:
                pass

        if joined_at_filter:
            queryset = queryset.filter(created_at__date=joined_at_filter)

        ordering_map = {
            "name": ["display_name", "owner__name"],
            "-name": ["-display_name", "-owner__name"],
            "owner": ["owner__name", "display_name"],
            "-owner": ["-owner__name", "-display_name"],
            "category": ["category__name", "display_name"],
            "-category": ["-category__name", "-display_name"],
            "status": ["status__name", "display_name"],
            "-status": ["-status__name", "-display_name"],
            "subscription_plan": ["subscription_plan__name", "display_name"],
            "-subscription_plan": ["-subscription_plan__name", "-display_name"],
            "rating": ["average_rating", "display_name"],
            "-rating": ["-average_rating", "-display_name"],
            "orders_count": ["orders_count", "display_name"],
            "-orders_count": ["-orders_count", "-display_name"],
            "revenue": ["total_revenue", "display_name"],
            "-revenue": ["-total_revenue", "-display_name"],
            "joined_at": ["created_at", "display_name"],
            "-joined_at": ["-created_at", "-display_name"],
        }
        queryset = queryset.order_by(
            *ordering_map.get(ordering, ordering_map["-joined_at"])
        )

        total_count = queryset.count()
        total_pages = max(ceil(total_count / page_size), 1)
        if page > total_pages:
            page = total_pages
        start = (page - 1) * page_size
        end = start + page_size

        results = [
            {
                "id": str(restaurant.id),
                "name": restaurant.display_name,
                "owner_name": restaurant.owner.name or restaurant.owner.email,
                "owner_email": restaurant.owner.email,
                "category": restaurant.category.name,
                "status": restaurant.status.code,
                "status_label": restaurant.status.name,
                "rating": to_float(restaurant.average_rating),
                "orders_count": restaurant.orders_count,
                "revenue": to_float(restaurant.total_revenue),
                "joined_at": restaurant.created_at.isoformat(),
                "subscription_plan": restaurant.subscription_plan.name,
                "subscription_plan_code": restaurant.subscription_plan.code,
                "last_order_at": (
                    restaurant.last_order_at.isoformat()
                    if restaurant.last_order_at
                    else None
                ),
            }
            for restaurant in queryset[start:end]
        ]

        counts = {
            "total": total_count,
            "active": queryset.filter(status__code="active").count(),
            "inactive": queryset.filter(status__code="inactive").count(),
            "other": queryset.exclude(status__code__in=["active", "inactive"]).count(),
        }
        return Response(
            {
                "counts": counts,
                "catalogs": {
                    "statuses": [
                        {"code": status.code, "name": status.name}
                        for status in RestaurantStatus.objects.filter(
                            is_active=True
                        ).order_by("name")
                    ],
                    "categories": [
                        {"code": category.code, "name": category.name}
                        for category in RestaurantCategory.objects.filter(
                            is_active=True
                        ).order_by("name")
                    ],
                    "subscription_plans": [
                        {"code": plan.code, "name": plan.name}
                        for plan in SubscriptionPlan.objects.filter(
                            is_active=True
                        ).order_by("name")
                    ],
                },
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "ordering": ordering,
                "results": results,
            }
        )

    def retrieve(self, request, pk=None):
        restaurant = Restaurant.objects.select_related(
            "category",
            "status",
            "subscription_plan",
            "order_capability",
            "delivery_setting",
        ).get(pk=pk)
        return Response(AdminRestaurantSerializer(restaurant).data)

    def partial_update(self, request, pk=None):
        restaurant = Restaurant.objects.get(pk=pk)
        serializer = AdminRestaurantSerializer(
            restaurant,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        refreshed = Restaurant.objects.select_related(
            "category",
            "status",
            "subscription_plan",
            "order_capability",
            "delivery_setting",
        ).get(pk=restaurant.pk)
        return Response(AdminRestaurantSerializer(refreshed).data)


class AdminReportsViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def list(self, request):
        today = timezone.localdate()
        start_date = today - timedelta(days=6)
        orders_queryset = Order.objects.filter(created_at__date__gte=start_date)

        daily_trends = []
        for offset in range(7):
            current_day = start_date + timedelta(days=offset)
            day_queryset = orders_queryset.filter(created_at__date=current_day)
            day_revenue = (
                day_queryset.aggregate(total=Sum("total_amount"))["total"] or 0
            )
            daily_trends.append(
                {
                    "date": current_day.isoformat(),
                    "label": current_day.strftime("%d %b"),
                    "orders": day_queryset.count(),
                    "revenue": to_float(day_revenue),
                }
            )

        category_performance = list(
            Restaurant.objects.values("category__name")
            .annotate(
                total_orders=Count("orders"),
                total_revenue=Sum("orders__total_amount"),
                total_restaurants=Count("id"),
            )
            .order_by("-total_orders", "category__name")[:6]
        )

        order_type_distribution = list(
            Order.objects.values("order_type__code", "order_type__name")
            .annotate(value=Count("id"))
            .order_by("-value", "order_type__name")
        )
        total_order_types = sum(item["value"] for item in order_type_distribution) or 1

        insights = []
        if daily_trends:
            best_day = max(daily_trends, key=lambda item: item["orders"])
            insights.append(
                {
                    "title": "Pico reciente de ordenes",
                    "description": f"El mejor dia reciente fue {best_day['label']} con {best_day['orders']} ordenes.",
                }
            )
        if category_performance:
            best_category = category_performance[0]
            insights.append(
                {
                    "title": "Categoria con mayor traccion",
                    "description": f"{best_category['category__name'] or 'Sin categoria'} lidera con {best_category['total_orders']} ordenes.",
                }
            )
        delayed_orders = Order.objects.filter(
            status__code__in=["new", "preparing"],
            created_at__lte=timezone.now() - timedelta(hours=2),
        ).count()
        insights.append(
            {
                "title": "Pedidos con demora operativa",
                "description": f"Actualmente hay {delayed_orders} pedidos con mas de 2 horas sin cerrar.",
            }
        )

        return Response(
            {
                "daily_trends": daily_trends,
                "category_performance": [
                    {
                        "category": row["category__name"] or "Sin categoria",
                        "orders": row["total_orders"],
                        "revenue": to_float(row["total_revenue"]),
                        "restaurants": row["total_restaurants"],
                    }
                    for row in category_performance
                ],
                "order_type_distribution": [
                    {
                        "code": row["order_type__code"],
                        "label": row["order_type__name"],
                        "value": row["value"],
                        "percentage": round(row["value"] / total_order_types * 100),
                    }
                    for row in order_type_distribution
                ],
                "insights": insights,
            }
        )


class AdminSettingsViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def list(self, request):
        platform_setting = get_or_create_platform_setting()
        security_setting = get_or_create_platform_security_setting()
        backup_frequencies = BackupFrequency.objects.filter(is_active=True).order_by(
            "name"
        )
        billing_periods = BillingPeriod.objects.filter(is_active=True).order_by("name")
        subscription_plans = SubscriptionPlan.objects.select_related(
            "billing_period"
        ).order_by("name")

        return Response(
            {
                "general": AdminPlatformSettingSerializer(platform_setting).data,
                "security": AdminPlatformSecuritySettingSerializer(
                    security_setting
                ).data,
                "catalogs": {
                    "backup_frequencies": [
                        {"code": frequency.code, "name": frequency.name}
                        for frequency in backup_frequencies
                    ],
                    "billing_periods": [
                        {"code": billing_period.code, "name": billing_period.name}
                        for billing_period in billing_periods
                    ],
                    "subscription_plans": [
                        {
                            "code": plan.code,
                            "name": plan.name,
                            "price_amount": to_float(plan.price_amount),
                            "currency_code": plan.currency_code,
                            "billing_period": plan.billing_period.name,
                        }
                        for plan in subscription_plans
                    ],
                },
            }
        )

    def partial_update(self, request, pk=None):
        platform_setting = get_or_create_platform_setting()
        security_setting = get_or_create_platform_security_setting()

        general_serializer = AdminPlatformSettingSerializer(
            platform_setting,
            data=request.data.get("general", {}),
            partial=True,
        )
        security_serializer = AdminPlatformSecuritySettingSerializer(
            security_setting,
            data=request.data.get("security", {}),
            partial=True,
        )
        general_serializer.is_valid(raise_exception=True)
        security_serializer.is_valid(raise_exception=True)
        general_serializer.save()
        security_serializer.save()

        return Response(
            {
                "general": AdminPlatformSettingSerializer(platform_setting).data,
                "security": AdminPlatformSecuritySettingSerializer(
                    security_setting
                ).data,
            }
        )
