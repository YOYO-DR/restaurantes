from django.db.models import Count
from django.db.models import Max
from django.db.models import Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import IsOwnerObjectOrAdminRole
from apps.core.permissions import get_user_owned_or_operated_restaurant_ids
from apps.core.permissions import is_admin_user
from apps.orders.models import OrderItem
from apps.orders.services import filter_orders_by_scope
from apps.restaurants.api.serializers import OwnerDashboardRecentOrderSerializer
from apps.restaurants.api.serializers import OwnerMenuCategorySerializer
from apps.restaurants.api.serializers import OwnerRestaurantReviewReplySerializer
from apps.restaurants.api.serializers import OwnerRestaurantReviewSerializer
from apps.restaurants.api.serializers import OwnerRestaurantTableSerializer
from apps.restaurants.api.serializers import OwnerRestaurantTableWriteSerializer
from apps.restaurants.api.serializers import PublicMenuCategorySerializer
from apps.restaurants.api.serializers import RestaurantDetailSerializer
from apps.restaurants.api.serializers import RestaurantListSerializer
from apps.restaurants.api.serializers import RestaurantPersonalizationSerializer
from apps.restaurants.api.serializers import RestaurantSettingsSerializer
from apps.restaurants.models import Restaurant
from apps.restaurants.services import ensure_menu_qr_code
from apps.restaurants.services import ensure_qr_catalogs
from apps.restaurants.services import ensure_table_qr_code


class PublicRestaurantViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = RestaurantListSerializer
    lookup_field = "slug"

    def get_queryset(self):
        return (
            Restaurant.objects.select_related(
                "category",
                "status",
                "branding",
                "social_links",
                "order_capability",
                "delivery_setting",
            )
            .prefetch_related(
                "addresses",
                "hours",
                "tables__status",
                "menu_categories__menu_items__images",
            )
            .filter(status__code="active")
            .order_by("display_name")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return RestaurantDetailSerializer
        return super().get_serializer_class()

    @action(detail=True, methods=["get"], permission_classes=[permissions.AllowAny])
    def menu(self, request, slug=None):
        restaurant = self.get_object()
        categories = restaurant.menu_categories.filter(is_active=True).prefetch_related(
            "menu_items__images",
        )
        serializer = PublicMenuCategorySerializer(
            categories,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(
            {
                "restaurant": {
                    "id": str(restaurant.id),
                    "slug": restaurant.slug,
                    "name": restaurant.display_name,
                    "currency_code": restaurant.currency_code,
                },
                "categories": serializer.data,
            },
        )


class OwnerRestaurantViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsOwnerObjectOrAdminRole]
    serializer_class = RestaurantDetailSerializer

    def get_queryset(self):
        queryset = Restaurant.objects.select_related(
            "category",
            "status",
            "branding",
            "social_links",
            "order_capability",
            "delivery_setting",
        ).prefetch_related(
            "addresses",
            "hours",
            "tables__status",
            "menu_categories__menu_items__images",
        )
        if is_admin_user(self.request.user):
            return queryset.order_by("display_name")
        restaurant_ids = get_user_owned_or_operated_restaurant_ids(self.request.user)
        return queryset.filter(id__in=restaurant_ids).order_by("display_name")

    @action(detail=True, methods=["get"])
    def menu(self, request, pk=None):
        restaurant = self.get_object()
        categories = restaurant.menu_categories.prefetch_related("menu_items__images")
        serializer = OwnerMenuCategorySerializer(
            categories,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(
            {
                "restaurant": {
                    "id": str(restaurant.id),
                    "slug": restaurant.slug,
                    "name": restaurant.display_name,
                },
                "categories": serializer.data,
            },
        )

    @action(detail=True, methods=["get"])
    def dashboard(self, request, pk=None):
        restaurant = self.get_object()
        today = timezone.localdate()
        order_scope = request.query_params.get("order_scope", "all").strip()
        orders_queryset = filter_orders_by_scope(
            restaurant.orders.select_related(
                "status",
                "order_type",
                "user",
            ).prefetch_related("items"),
            order_scope,
        )

        sales_today = (
            orders_queryset.filter(created_at__date=today).aggregate(
                total=Sum("total_amount"),
            )["total"]
            or 0
        )
        orders_today = orders_queryset.filter(created_at__date=today).count()
        new_customers_this_week = (
            orders_queryset.filter(
                created_at__date__gte=today - timezone.timedelta(days=6),
            )
            .values("user_id")
            .distinct()
            .count()
        )
        recent_orders = orders_queryset.order_by("-created_at")[:5]
        top_products = (
            OrderItem.objects.filter(order__restaurant=restaurant)
            .values("item_name_snapshot")
            .annotate(orders=Sum("quantity"), revenue=Sum("line_total_amount"))
            .order_by("-orders", "item_name_snapshot")[:5]
        )
        monthly_sales = (
            orders_queryset.filter(
                created_at__year=today.year,
                created_at__month=today.month,
            ).aggregate(total=Sum("total_amount"))["total"]
            or 0
        )
        new_orders_count = orders_queryset.filter(status__code="new").count()

        return Response(
            {
                "restaurant": {
                    "id": str(restaurant.id),
                    "name": restaurant.display_name,
                    "average_rating": str(restaurant.average_rating),
                    "total_reviews": restaurant.total_reviews,
                },
                "metrics": {
                    "sales_today": sales_today,
                    "orders_today": orders_today,
                    "new_customers_this_week": new_customers_this_week,
                    "monthly_sales": monthly_sales,
                    "new_orders_count": new_orders_count,
                },
                "order_scope": order_scope,
                "recent_orders": OwnerDashboardRecentOrderSerializer(
                    recent_orders,
                    many=True,
                ).data,
                "top_products": [
                    {
                        "name": product["item_name_snapshot"],
                        "orders": product["orders"],
                        "revenue": product["revenue"],
                    }
                    for product in top_products
                ],
            },
        )

    @action(detail=True, methods=["get"])
    def customers(self, request, pk=None):
        restaurant = self.get_object()
        order_scope = request.query_params.get("order_scope", "all").strip()
        scoped_orders = filter_orders_by_scope(
            restaurant.orders.select_related("user"),
            order_scope,
        )
        customer_rows = scoped_orders.values(
            "user_id",
            "user__name",
            "user__email",
            "customer_name",
            "customer_email",
        ).annotate(
            total_orders=Count("id"),
            total_spent=Sum("total_amount"),
            last_order=Max("created_at"),
        )

        user_ids = [row["user_id"] for row in customer_rows if row["user_id"]]
        from apps.loyalty.models import LoyaltyAccount
        loyalty_dict = {
            acc.user_id: acc
            for acc in LoyaltyAccount.objects.filter(restaurant=restaurant, user_id__in=user_ids).select_related("tier")
        }

        customers = []
        vip_count = 0
        for row in customer_rows:
            total_orders = row["total_orders"] or 0
            total_spent = row["total_spent"] or 0
            average_ticket = total_spent / total_orders if total_orders else 0
            loyalty_account = loyalty_dict.get(row["user_id"]) if row["user_id"] else None
            points = loyalty_account.current_points if loyalty_account else 0
            tier = loyalty_account.tier.name if loyalty_account else "Base"
            if points >= 1000:
                vip_count += 1
            favorite_items = list(
                OrderItem.objects.filter(
                    order__in=scoped_orders,
                    order__user_id=row["user_id"],
                )
                .values("item_name_snapshot")
                .annotate(total=Sum("quantity"))
                .order_by("-total", "item_name_snapshot")[:3],
            )
            customers.append(
                {
                    "id": str(
                        row["user_id"] or row["customer_email"] or row["customer_name"],
                    ),
                    "name": row["user__name"]
                    or row["user__email"]
                    or row["customer_name"],
                    "email": row["user__email"] or row["customer_email"],
                    "total_orders": total_orders,
                    "total_spent": total_spent,
                    "average_ticket": average_ticket,
                    "points": points,
                    "tier": tier,
                    "favorite_items": [
                        item["item_name_snapshot"] for item in favorite_items
                    ],
                },
            )

        customers.sort(key=lambda item: item["total_spent"], reverse=True)
        average_ticket = (
            sum(customer["average_ticket"] for customer in customers) / len(customers)
            if customers
            else 0
        )

        return Response(
            {
                "metrics": {
                    "total_customers": len(customers),
                    "new_customers_this_month": scoped_orders.filter(
                        created_at__year=timezone.localdate().year,
                        created_at__month=timezone.localdate().month,
                    )
                    .values("user_id")
                    .distinct()
                    .count(),
                    "average_ticket": average_ticket,
                    "vip_customers": vip_count,
                },
                "order_scope": order_scope,
                "customers": customers,
            },
        )

    @action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        restaurant = self.get_object()
        today = timezone.localdate()
        order_scope = request.query_params.get("order_scope", "all").strip()
        periods = {
            "today": filter_orders_by_scope(
                restaurant.orders.filter(created_at__date=today),
                order_scope,
            ),
            "week": filter_orders_by_scope(
                restaurant.orders.filter(
                    created_at__date__gte=today - timezone.timedelta(days=6),
                ),
                order_scope,
            ),
            "month": filter_orders_by_scope(
                restaurant.orders.filter(
                    created_at__year=today.year,
                    created_at__month=today.month,
                ),
                order_scope,
            ),
            "year": filter_orders_by_scope(
                restaurant.orders.filter(created_at__year=today.year),
                order_scope,
            ),
        }

        sales = {}
        for key, queryset in periods.items():
            total_sales = queryset.aggregate(total=Sum("total_amount"))["total"] or 0
            sales[key] = {
                "value": total_sales,
                "orders": queryset.count(),
                "new_customers": queryset.values("user_id").distinct().count(),
                "average_ticket": (total_sales / queryset.count())
                if queryset.count()
                else 0,
            }

        hourly_data = []
        for hour in range(11, 22):
            count = periods["today"].filter(created_at__hour=hour).count()
            hourly_data.append({"hour": f"{hour:02d}:00", "orders": count})

        top_products = list(
            OrderItem.objects.filter(
                order__in=periods["month"],
            )
            .values("item_name_snapshot")
            .annotate(orders=Sum("quantity"), revenue=Sum("line_total_amount"))
            .order_by("-orders", "item_name_snapshot")[:5],
        )

        total_customers = periods["year"].values("user_id").distinct().count()
        new_this_month = periods["month"].values("user_id").distinct().count()
        returning_customers = (
            periods["year"]
            .values("user_id")
            .annotate(total=Count("id"))
            .filter(total__gt=1)
            .count()
        )
        returning_rate = (
            (returning_customers / total_customers * 100) if total_customers else 0
        )

        return Response(
            {
                "sales": sales,
                "hourly_data": hourly_data,
                "top_products": [
                    {
                        "name": product["item_name_snapshot"],
                        "orders": product["orders"],
                        "revenue": product["revenue"],
                        "change": 0,
                    }
                    for product in top_products
                ],
                "customer_metrics": {
                    "total_customers": total_customers,
                    "new_this_month": new_this_month,
                    "returning": round(returning_rate),
                    "average_ticket": sales["month"]["average_ticket"],
                },
                "order_scope": order_scope,
            },
        )

    @action(
        detail=True,
        methods=["get", "patch"],
        url_path="settings",
        url_name="settings",
    )
    def restaurant_settings(self, request, pk=None):
        restaurant = self.get_object()

        if request.method == "GET":
            return Response(RestaurantSettingsSerializer(restaurant).data)

        serializer = RestaurantSettingsSerializer(
            restaurant,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        refreshed_restaurant = self.get_queryset().get(pk=restaurant.pk)
        return Response(RestaurantSettingsSerializer(refreshed_restaurant).data)

    @action(detail=True, methods=["get"])
    def reviews(self, request, pk=None):
        restaurant = self.get_object()
        reviews_queryset = (
            restaurant.reviews.select_related("user", "order")
            .prefetch_related("order__items")
            .order_by("-created_at")
        )

        distribution = []
        total_reviews = reviews_queryset.count()
        for rating in range(5, 0, -1):
            count = reviews_queryset.filter(rating=rating).count()
            percentage = round((count / total_reviews * 100), 0) if total_reviews else 0
            distribution.append(
                {"rating": rating, "count": count, "percentage": percentage},
            )

        this_month = reviews_queryset.filter(
            created_at__year=timezone.localdate().year,
            created_at__month=timezone.localdate().month,
        ).count()
        pending_replies = reviews_queryset.filter(owner_reply="").count()

        return Response(
            {
                "metrics": {
                    "average_rating": str(restaurant.average_rating),
                    "total_reviews": total_reviews,
                    "this_month": this_month,
                    "pending_replies": pending_replies,
                },
                "distribution": distribution,
                "reviews": OwnerRestaurantReviewSerializer(
                    reviews_queryset,
                    many=True,
                ).data,
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="reviews/(?P<review_id>[^/.]+)/reply",
    )
    def reply_review(self, request, pk=None, review_id=None):
        restaurant = self.get_object()
        review = restaurant.reviews.get(pk=review_id)
        serializer = OwnerRestaurantReviewReplySerializer(review, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            OwnerRestaurantReviewSerializer(review).data,
        )

    @action(detail=True, methods=["get", "patch"], url_path="personalization")
    def personalization(self, request, pk=None):
        restaurant = self.get_object()

        if request.method == "GET":
            return Response(
                RestaurantPersonalizationSerializer(
                    restaurant,
                    context={"request": request},
                ).data,
            )

        serializer = RestaurantPersonalizationSerializer(
            restaurant,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        refreshed_restaurant = self.get_queryset().get(pk=restaurant.pk)
        return Response(
            RestaurantPersonalizationSerializer(
                refreshed_restaurant,
                context={"request": request},
            ).data,
        )

    @action(detail=True, methods=["get"])
    def qrs(self, request, pk=None):
        restaurant = self.get_object()
        ensure_qr_catalogs()
        base_url = request.build_absolute_uri("/").rstrip("/")
        menu_qr = ensure_menu_qr_code(base_url, restaurant)
        tables = restaurant.tables.select_related("status").order_by("table_number")
        for table in tables:
            ensure_table_qr_code(base_url, restaurant, table)

        return Response(
            {
                "restaurant": {
                    "id": str(restaurant.id),
                    "name": restaurant.display_name,
                    "slug": restaurant.slug,
                    "table_order_enabled": restaurant.order_capability.table_order_enabled,
                },
                "menu_qr": {"url": menu_qr.qr_url, "is_active": menu_qr.is_active},
                "tables": OwnerRestaurantTableSerializer(tables, many=True).data,
            },
        )

    @action(detail=True, methods=["post"], url_path="tables")
    def create_table(self, request, pk=None):
        restaurant = self.get_object()
        ensure_qr_catalogs()
        serializer = OwnerRestaurantTableWriteSerializer(
            data=request.data,
            context={"restaurant": restaurant},
        )
        serializer.is_valid(raise_exception=True)
        table = serializer.save()
        base_url = request.build_absolute_uri("/").rstrip("/")
        ensure_table_qr_code(base_url, restaurant, table)
        return Response(
            OwnerRestaurantTableSerializer(table).data,
            status=201,
        )

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path="tables/(?P<table_id>[^/.]+)",
    )
    def update_table(self, request, pk=None, table_id=None):
        restaurant = self.get_object()
        table = restaurant.tables.get(pk=table_id)

        if request.method == "DELETE":
            restaurant.qr_codes.filter(target_id=table.id).delete()
            table.delete()
            return Response(status=204)

        serializer = OwnerRestaurantTableWriteSerializer(
            table,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        table = serializer.save()
        base_url = request.build_absolute_uri("/").rstrip("/")
        ensure_table_qr_code(base_url, restaurant, table)
        return Response(OwnerRestaurantTableSerializer(table).data)
