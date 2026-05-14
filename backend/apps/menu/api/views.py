from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ModelViewSet

from apps.core.permissions import InventarioModulePermission
from apps.core.permissions import IsAuthenticatedUser
from apps.core.permissions import IsOwnerOfRestaurantResourceOrAdminRole
from apps.core.permissions import MenuModulePermission
from apps.core.permissions import get_user_owned_or_operated_restaurant_ids
from apps.core.permissions import is_admin_user
from apps.menu.api.serializers import InventoryItemSerializer
from apps.menu.api.serializers import InventoryMovementCreateSerializer
from apps.menu.api.serializers import InventoryUnitSerializer
from apps.menu.api.serializers import MenuItemAvailabilitySerializer
from apps.menu.api.serializers import OwnerMenuCategoryWriteSerializer
from apps.menu.api.serializers import OwnerMenuItemWriteSerializer
from apps.menu.models import InventoryItem
from apps.menu.models import MenuCategory
from apps.menu.models import MenuItem
from apps.menu.models import UnitType
from apps.menu.services import ensure_inventory_catalogs


class OwnerMenuItemViewSet(GenericViewSet):
    permission_classes = [MenuModulePermission]
    serializer_class = MenuItemAvailabilitySerializer
    queryset = MenuItem.objects.select_related("restaurant")

    @action(detail=True, methods=["patch"])
    def availability(self, request, pk=None):
        menu_item = self.get_object()
        self.check_object_permissions(request, menu_item)

        serializer = self.get_serializer(menu_item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_200_OK)


class OwnerMenuCategoryViewSet(ModelViewSet):
    permission_classes = [MenuModulePermission]
    serializer_class = OwnerMenuCategoryWriteSerializer
    queryset = MenuCategory.objects.select_related("restaurant")

    def get_queryset(self):
        queryset = self.queryset.order_by("sort_order", "name")
        if is_admin_user(self.request.user):
            filtered_queryset = queryset
        else:
            restaurant_ids = get_user_owned_or_operated_restaurant_ids(
                self.request.user,
            )
            filtered_queryset = queryset.filter(restaurant_id__in=restaurant_ids)

        restaurant_id = self.request.query_params.get("restaurant")
        search = self.request.query_params.get("search", "").strip()

        if restaurant_id:
            filtered_queryset = filtered_queryset.filter(restaurant_id=restaurant_id)

        if search:
            filtered_queryset = filtered_queryset.filter(name__icontains=search)

        return filtered_queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        limit = request.query_params.get("limit")

        if limit:
            try:
                queryset = queryset[: max(int(limit), 0)]
            except ValueError:
                pass

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OwnerMenuCrudItemViewSet(ModelViewSet):
    permission_classes = [MenuModulePermission]
    serializer_class = OwnerMenuItemWriteSerializer
    queryset = MenuItem.objects.select_related("restaurant", "menu_category")

    def get_queryset(self):
        queryset = self.queryset.order_by("name")
        if is_admin_user(self.request.user):
            return queryset
        restaurant_ids = get_user_owned_or_operated_restaurant_ids(self.request.user)
        return queryset.filter(restaurant_id__in=restaurant_ids)


class OwnerInventoryItemViewSet(ModelViewSet):
    permission_classes = [InventarioModulePermission]
    serializer_class = InventoryItemSerializer
    queryset = InventoryItem.objects.select_related("restaurant", "unit_type")

    def get_queryset(self):
        queryset = self.queryset.order_by("name")
        if is_admin_user(self.request.user):
            filtered_queryset = queryset
        else:
            restaurant_ids = get_user_owned_or_operated_restaurant_ids(
                self.request.user,
            )
            filtered_queryset = queryset.filter(restaurant_id__in=restaurant_ids)

        restaurant_id = self.request.query_params.get("restaurant")
        search = self.request.query_params.get("search", "").strip()

        if restaurant_id:
            filtered_queryset = filtered_queryset.filter(restaurant_id=restaurant_id)

        if search:
            filtered_queryset = filtered_queryset.filter(name__icontains=search)

        return filtered_queryset

    @action(detail=True, methods=["post"], url_path="movements")
    def movements(self, request, pk=None):
        inventory_item = self.get_object()
        self.check_object_permissions(request, inventory_item)

        serializer = InventoryMovementCreateSerializer(
            data=request.data,
            context={"request": request, "inventory_item": inventory_item},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            InventoryItemSerializer(inventory_item, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class OwnerInventoryMetadataViewSet(GenericViewSet):
    permission_classes = [InventarioModulePermission]

    def list(self, request, *args, **kwargs):
        ensure_inventory_catalogs()
        units = UnitType.objects.filter(is_active=True).order_by("name")
        return Response(
            {"units": InventoryUnitSerializer(units, many=True).data},
            status=status.HTTP_200_OK,
        )
