from __future__ import annotations

import io
import mimetypes
import os
from pathlib import Path

from PIL import Image
from PIL import UnidentifiedImageError
from django.core.exceptions import ImproperlyConfigured
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.order_chat.api.serializers import OrderChatDetailSerializer
from apps.order_chat.api.serializers import OrderChatMessageCreateSerializer
from apps.order_chat.api.serializers import OrderChatMessageSerializer
from apps.order_chat.api.serializers import OrderChatReadSerializer
from apps.order_chat.api.serializers import OrderRestaurantContactSerializer
from apps.order_chat.api.serializers import PlatformChatConfigSerializer
from apps.order_chat.models import OrderChat
from apps.order_chat.models import OrderChatMessage
from apps.order_chat.permissions import OrderChatAccessPermission
from apps.order_chat.permissions import get_tracking_code_from_request
from apps.order_chat.permissions import has_order_chat_access
from apps.order_chat.permissions import is_restaurant_member
from apps.order_chat.services import assert_message_rate_limit
from apps.order_chat.services import broadcast_chat_event
from apps.order_chat.services import build_sender_label
from apps.order_chat.services import get_actor_key
from apps.order_chat.services import message_payload
from apps.order_chat.services import parse_allowed_mimes
from apps.order_chat.services import rename_uploaded_image
from apps.order_chat.services import sanitize_message_body
from apps.orders.models import Order
from apps.platform_config.models import PlatformSetting
from apps.restaurants.models import RestaurantAddress
from apps.restaurants.models import RestaurantBranding
from apps.restaurants.models import RestaurantHour

try:
    import magic
except ImportError:  # pragma: no cover
    magic = None


def get_platform_setting() -> PlatformSetting:
    setting = PlatformSetting.objects.first()
    if setting is not None:
        return setting
    return PlatformSetting.objects.create(platform_name="FoodHub")


class OrderBaseChatAPIView(APIView):
    permission_classes = [permissions.AllowAny]
    object_permission = OrderChatAccessPermission()

    def get_order(self, order_id):
        order = get_object_or_404(Order.objects.select_related("restaurant", "chat"), id=order_id)
        if not self.object_permission.has_object_permission(self.request, self, order):
            return None
        return order

    def get_or_create_chat(self, order: Order) -> OrderChat:
        chat = getattr(order, "chat", None)
        if chat is None:
            chat = OrderChat.objects.create(order=order)
        return chat


class OrderContactInfoView(OrderBaseChatAPIView):
    def get(self, request, order_id):
        order = self.get_order(order_id)
        if order is None:
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)

        restaurant = order.restaurant
        branding = RestaurantBranding.objects.filter(restaurant_id=restaurant.id).first()
        primary_address = (
            RestaurantAddress.objects.filter(restaurant_id=restaurant.id, is_primary=True).first()
            or RestaurantAddress.objects.filter(restaurant_id=restaurant.id).first()
        )
        hours = RestaurantHour.objects.filter(restaurant_id=restaurant.id).order_by("weekday")

        address = ""
        if primary_address:
            address = ", ".join(
                [
                    value
                    for value in [
                        primary_address.line1,
                        primary_address.city,
                        primary_address.state,
                    ]
                    if value
                ],
            )

        serializer = OrderRestaurantContactSerializer(
            {
                "name": restaurant.display_name,
                "phone": restaurant.phone,
                "email": restaurant.email,
                "address": address,
                "logo_url": branding.logo_url if branding else "",
                "hours": hours,
            },
        )
        return Response(serializer.data)


class OrderChatView(OrderBaseChatAPIView):
    def get(self, request, order_id):
        order = self.get_order(order_id)
        if order is None:
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)

        chat = self.get_or_create_chat(order)
        serializer = OrderChatDetailSerializer(chat, context={"request": request})
        return Response(serializer.data)


class OrderChatMessagesView(OrderBaseChatAPIView):
    def post(self, request, order_id):
        serializer = OrderChatMessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = self.get_order(order_id)
        if order is None:
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)
        chat = self.get_or_create_chat(order)

        if chat.is_closed:
            return Response({"code": "chat_closed"}, status=status.HTTP_403_FORBIDDEN)

        tracking_code = get_tracking_code_from_request(request)
        actor_key = get_actor_key(request.user, tracking_code)
        if not assert_message_rate_limit(actor_key, chat.id):
            return Response({"code": "rate_limited"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        settings_obj = get_platform_setting()
        image = serializer.validated_data.get("image")
        body = sanitize_message_body(serializer.validated_data.get("body") or "")

        if image and not settings_obj.chat_images_enabled:
            return Response({"code": "images_disabled"}, status=status.HTTP_400_BAD_REQUEST)

        if image:
            max_bytes = settings_obj.chat_image_max_mb * 1024 * 1024
            if image.size > max_bytes:
                return Response({"code": "image_too_large"}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

            if magic is None:
                raise ImproperlyConfigured("python-magic es requerido para validar MIME en chat.")

            allowed_mimes = parse_allowed_mimes(settings_obj.chat_image_allowed_mimes)
            guessed_mime = image.content_type or mimetypes.guess_type(image.name)[0] or ""
            detected_mime = magic.from_buffer(image.read(4096), mime=True) or guessed_mime
            image.seek(0)

            if (detected_mime or "").lower() not in allowed_mimes:
                return Response({"code": "invalid_image_type"}, status=status.HTTP_400_BAD_REQUEST)

            file_bytes = image.read()
            image.seek(0)
            try:
                with Image.open(io.BytesIO(file_bytes)) as img:
                    img.verify()
            except (UnidentifiedImageError, OSError):
                return Response({"code": "invalid_image"}, status=status.HTTP_400_BAD_REQUEST)

            suffix = Path(image.name).suffix or mimetypes.guess_extension(detected_mime) or ".jpg"
            rename_uploaded_image(image, suffix)

        sender_kind = OrderChatMessage.SenderKind.GUEST
        user = request.user
        if user and user.is_authenticated:
            if order.user_id == user.id:
                sender_kind = OrderChatMessage.SenderKind.CUSTOMER
            else:
                sender_kind = OrderChatMessage.SenderKind.RESTAURANT

        message = OrderChatMessage.objects.create(
            chat=chat,
            sender_user=user if user.is_authenticated else None,
            sender_kind=sender_kind,
            sender_label=build_sender_label(order, user, sender_kind),
            body=body,
            image=image,
        )

        payload = message_payload(message)
        broadcast_chat_event(order.id, "chat.message", payload)
        return Response(
            OrderChatMessageSerializer(message, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class OrderChatReadView(OrderBaseChatAPIView):
    def post(self, request, order_id):
        serializer = OrderChatReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = self.get_order(order_id)
        if order is None:
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)

        chat = self.get_or_create_chat(order)
        now = timezone.now()
        user = request.user

        if user.is_authenticated and is_restaurant_member(user, order.restaurant_id):
            updated = chat.messages.filter(
                sender_kind__in=[
                    OrderChatMessage.SenderKind.CUSTOMER,
                    OrderChatMessage.SenderKind.GUEST,
                ],
                read_by_restaurant_at__isnull=True,
            ).update(read_by_restaurant_at=now)
        else:
            updated = chat.messages.filter(
                sender_kind=OrderChatMessage.SenderKind.RESTAURANT,
                read_by_customer_at__isnull=True,
            ).update(read_by_customer_at=now)

        broadcast_chat_event(order.id, "chat.read", {"updated": updated})
        return Response({"updated": updated}, status=status.HTTP_200_OK)


class OrderChatImageView(APIView):
    permission_classes = [permissions.AllowAny]
    object_permission = OrderChatAccessPermission()

    def get(self, request, message_id):
        message = get_object_or_404(
            OrderChatMessage.objects.select_related("chat", "chat__order"),
            id=message_id,
        )
        if not message.image or message.image_purged:
            return Response({"detail": "Archivo no disponible."}, status=status.HTTP_404_NOT_FOUND)

        order = message.chat.order
        tracking_code = get_tracking_code_from_request(request)
        if not has_order_chat_access(order, request.user, tracking_code):
            return Response({"detail": "No autorizado."}, status=status.HTTP_403_FORBIDDEN)

        filename = os.path.basename(message.image.name)
        inline = request.query_params.get("inline") == "1"
        response = FileResponse(
            message.image.open("rb"),
            as_attachment=not inline,
            filename=filename,
        )
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response


class PlatformChatConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        setting = get_platform_setting()
        serializer = PlatformChatConfigSerializer(
            {
                "chat_images_enabled": setting.chat_images_enabled,
                "chat_image_max_mb": setting.chat_image_max_mb,
                "chat_image_allowed_mimes": list(
                    parse_allowed_mimes(setting.chat_image_allowed_mimes),
                ),
                "chat_post_close_purge_hours": setting.chat_post_close_purge_hours,
            },
        )
        return Response(serializer.data)
