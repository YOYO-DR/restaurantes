from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ModelViewSet


class BillingPagePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

from apps.billing.api.serializers import AdminSubscriptionPatchSerializer
from apps.billing.api.serializers import DecisionSerializer
from apps.billing.api.serializers import FeatureDependencySerializer
from apps.billing.api.serializers import FeatureSerializer
from apps.billing.api.serializers import PlanDetailSerializer
from apps.billing.api.serializers import PlanFeaturesWriteSerializer
from apps.billing.api.serializers import PlanListSerializer
from apps.billing.api.serializers import PlanWriteSerializer
from apps.billing.api.serializers import PlanChangeRequestSerializer
from apps.billing.api.serializers import RestaurantFeatureOverrideSerializer
from apps.billing.api.serializers import RestaurantSubscriptionSerializer
from apps.billing.api.serializers import SubscriptionEventSerializer
from apps.billing.api.serializers import TrialConfigSerializer
from apps.billing.models import Feature
from apps.billing.models import FeatureDependency
from apps.billing.models import Plan
from apps.billing.models import PlanChangeRequest
from apps.billing.models import PlanFeature
from apps.billing.models import RestaurantFeatureOverride
from apps.billing.models import RestaurantSubscription
from apps.billing.models import SubscriptionEvent
from apps.billing.models import TrialConfig
from apps.core.permissions import IsAdminRole


class AdminFeaturesViewSet(ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = FeatureSerializer
    queryset = Feature.objects.all().order_by("sort_order", "name")

    @action(detail=True, methods=["get", "post"], url_path="dependencies")
    def dependencies(self, request, pk=None):
        feature = self.get_object()

        if request.method == "GET":
            deps = feature.dependencies.select_related("depends_on").all()
            return Response(FeatureDependencySerializer(deps, many=True).data)

        data = request.data if isinstance(request.data, list) else request.data.get("depends_on_ids", [])
        from apps.billing.services.dependencies import detect_cycle
        from django.core.exceptions import ValidationError

        FeatureDependency.objects.filter(feature=feature).delete()
        errors = []
        for dep_id in data:
            try:
                dep_feature = Feature.objects.get(pk=dep_id)
            except Feature.DoesNotExist:
                errors.append(f"Feature {dep_id} no existe.")
                continue
            if detect_cycle(feature, dep_feature):
                errors.append(f"Agregar '{dep_feature.code}' crearía un ciclo.")
                continue
            FeatureDependency.objects.get_or_create(feature=feature, depends_on=dep_feature)

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        deps = feature.dependencies.select_related("depends_on").all()
        return Response(FeatureDependencySerializer(deps, many=True).data)


class AdminPlansViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]
    queryset = Plan.objects.all()

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return PlanWriteSerializer
        if self.action == "retrieve":
            return PlanDetailSerializer
        return PlanListSerializer

    def list(self, request):
        plans = self.get_queryset().order_by("sort_order", "name")
        return Response(PlanListSerializer(plans, many=True).data)

    def retrieve(self, request, pk=None):
        plan = self.get_object()
        return Response(PlanDetailSerializer(plan).data)

    def create(self, request):
        ser = PlanWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        plan = ser.save()
        return Response(PlanDetailSerializer(plan).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        plan = self.get_object()
        ser = PlanWriteSerializer(plan, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        plan = ser.save()
        return Response(PlanDetailSerializer(plan).data)

    def destroy(self, request, pk=None):
        plan = self.get_object()
        if plan.subscriptions.exists():
            return Response(
                {"detail": "No se puede eliminar un plan con restaurantes asignados."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "post"], url_path="features")
    def features(self, request, pk=None):
        plan = self.get_object()

        if request.method == "GET":
            pfs = plan.plan_features.select_related("feature").all()
            from apps.billing.api.serializers import PlanFeatureSerializer
            return Response(PlanFeatureSerializer(pfs, many=True).data)

        ser = PlanFeaturesWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data
        expanded = vd.get("_expanded_features", {})

        with_features = []
        for item in vd["features"]:
            try:
                feat = Feature.objects.get(pk=item["feature_id"])
            except Feature.DoesNotExist:
                continue
            with_features.append((feat, item))

        if expanded:
            existing_ids = {f.pk for f, _ in with_features}
            for code, feat in expanded.items():
                if feat.pk not in existing_ids:
                    with_features.append((feat, {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True}))

        PlanFeature.objects.filter(plan=plan).delete()
        for feat, item in with_features:
            PlanFeature.objects.create(
                plan=plan,
                feature=feat,
                can_view=item.get("can_view", False),
                can_create=item.get("can_create", False),
                can_edit=item.get("can_edit", False),
                can_delete=item.get("can_delete", False),
            )

        pfs = plan.plan_features.select_related("feature").all()
        from apps.billing.api.serializers import PlanFeatureSerializer
        return Response(PlanFeatureSerializer(pfs, many=True).data)


class AdminTrialConfigViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def list(self, request):
        config = TrialConfig.objects.prefetch_related("trial_feature_defaults__feature").first()
        if config is None:
            return Response({})
        return Response(TrialConfigSerializer(config).data)

    def partial_update(self, request, pk=None):
        config = TrialConfig.objects.first()
        if config is None:
            return Response({"detail": "TrialConfig no inicializado."}, status=status.HTTP_404_NOT_FOUND)

        from apps.billing.models import TrialFeatureDefault

        is_enabled = request.data.get("is_enabled")
        default_trial_days = request.data.get("default_trial_days")
        trial_plan_id = request.data.get("trial_plan")
        trial_features = request.data.get("trial_features")

        if is_enabled is not None:
            config.is_enabled = bool(is_enabled)
        if default_trial_days is not None:
            config.default_trial_days = int(default_trial_days)
        if trial_plan_id is not None:
            config.trial_plan_id = trial_plan_id
        config.save()

        if trial_features is not None:
            TrialFeatureDefault.objects.filter(trial_config=config).delete()
            for item in trial_features:
                try:
                    feat = Feature.objects.get(pk=item.get("feature"))
                except Feature.DoesNotExist:
                    continue
                TrialFeatureDefault.objects.create(
                    trial_config=config,
                    feature=feat,
                    can_view=item.get("can_view", True),
                    can_create=item.get("can_create", True),
                    can_edit=item.get("can_edit", True),
                    can_delete=item.get("can_delete", False),
                )

        config.refresh_from_db()
        return Response(TrialConfigSerializer(config).data)


class AdminRestaurantSubscriptionViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]

    def _ensure_subscription(self, restaurant_id, actor=None):
        from django.shortcuts import get_object_or_404

        from apps.billing.services.subscriptions import start_trial
        from apps.restaurants.models import Restaurant

        restaurant = get_object_or_404(Restaurant, pk=restaurant_id)
        subscription = (
            RestaurantSubscription.objects.select_related("restaurant", "plan")
            .filter(restaurant=restaurant)
            .first()
        )
        if subscription is not None:
            return subscription

        start_trial(restaurant, actor=actor)
        return RestaurantSubscription.objects.select_related("restaurant", "plan").get(
            restaurant=restaurant,
        )

    def retrieve(self, request, pk=None):
        sub = self._ensure_subscription(pk, actor=request.user)
        return Response(RestaurantSubscriptionSerializer(sub).data)

    def partial_update(self, request, pk=None):
        from apps.billing.services.subscriptions import activate_subscription
        from apps.billing.services.subscriptions import start_trial

        ser = AdminSubscriptionPatchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data

        sub = self._ensure_subscription(pk, actor=request.user)

        if vd.get("plan"):
            try:
                plan = Plan.objects.get(pk=vd["plan"])
            except Plan.DoesNotExist:
                return Response({"detail": "Plan no encontrado."}, status=status.HTTP_400_BAD_REQUEST)
            activate_subscription(sub.restaurant, plan, actor=request.user)

        if "override_trial_days" in vd:
            from datetime import timedelta
            from django.utils import timezone
            sub.override_trial_days = vd["override_trial_days"]
            if sub.status == RestaurantSubscription.STATUS_TRIAL and sub.trial_start:
                sub.trial_end = sub.trial_start + timedelta(days=vd["override_trial_days"])
            sub.save(update_fields=["override_trial_days", "trial_end"])

        if vd.get("force_reset_trial"):
            start_trial(sub.restaurant, actor=request.user)

        sub.refresh_from_db()
        return Response(RestaurantSubscriptionSerializer(sub).data)

    @action(detail=True, methods=["get", "post"], url_path="overrides")
    def overrides(self, request, pk=None):
        if request.method == "GET":
            overrides = RestaurantFeatureOverride.objects.filter(restaurant_id=pk).select_related("feature")
            return Response(RestaurantFeatureOverrideSerializer(overrides, many=True).data)

        from apps.restaurants.models import Restaurant
        from django.shortcuts import get_object_or_404

        restaurant = get_object_or_404(Restaurant, pk=pk)

        ser = RestaurantFeatureOverrideSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            feature = Feature.objects.get(pk=ser.validated_data["feature"].pk)
        except Feature.DoesNotExist:
            return Response({"detail": "Feature no encontrado."}, status=status.HTTP_404_NOT_FOUND)

        override, _ = RestaurantFeatureOverride.objects.update_or_create(
            restaurant=restaurant,
            feature=feature,
            defaults={
                **{k: ser.validated_data[k] for k in ("can_view", "can_create", "can_edit", "can_delete")},
                "source": RestaurantFeatureOverride.SOURCE_ADMIN,
                "expires_at": ser.validated_data.get("expires_at"),
            },
        )
        from apps.billing.services.events import log_event
        log_event(restaurant, "override_set", actor=request.user, payload={"feature": feature.code})

        return Response(RestaurantFeatureOverrideSerializer(override).data, status=status.HTTP_201_CREATED)


class AdminPlanChangeRequestViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]
    pagination_class = BillingPagePagination

    def get_queryset(self):
        qs = PlanChangeRequest.objects.select_related(
            "restaurant", "requested_plan", "current_plan", "requested_by", "decided_by"
        ).order_by("-created_at")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        restaurant_id = self.request.query_params.get("restaurant")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        return qs

    def list(self, request):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(PlanChangeRequestSerializer(page, many=True).data)
        return Response(PlanChangeRequestSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        req = get_object_or_404(self.get_queryset(), pk=pk)
        return Response(PlanChangeRequestSerializer(req).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        from apps.billing.services.requests import approve_request

        ser = DecisionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req = get_object_or_404(PlanChangeRequest, pk=pk)
        try:
            approved = approve_request(req, request.user, notes=ser.validated_data["notes"])
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PlanChangeRequestSerializer(approved).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        from apps.billing.services.requests import reject_request

        ser = DecisionSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        req = get_object_or_404(PlanChangeRequest, pk=pk)
        try:
            rejected = reject_request(req, request.user, notes=ser.validated_data["notes"])
        except Exception as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PlanChangeRequestSerializer(rejected).data)


class AdminSubscriptionEventsViewSet(GenericViewSet):
    permission_classes = [IsAdminRole]
    pagination_class = BillingPagePagination

    def get_queryset(self):
        qs = SubscriptionEvent.objects.select_related(
            "restaurant", "old_plan", "new_plan", "actor"
        ).order_by("-created_at")
        restaurant_id = self.request.query_params.get("restaurant")
        if restaurant_id:
            qs = qs.filter(restaurant_id=restaurant_id)
        event_type = self.request.query_params.get("event_type")
        if event_type:
            qs = qs.filter(event_type=event_type)
        return qs

    def list(self, request):
        qs = self.get_queryset()
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(SubscriptionEventSerializer(page, many=True).data)
        return Response(SubscriptionEventSerializer(qs, many=True).data)
