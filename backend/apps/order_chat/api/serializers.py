from __future__ import annotations

from rest_framework import serializers

from apps.order_chat.models import OrderChat
from apps.order_chat.models import OrderChatMessage
from apps.restaurants.models import RestaurantHour


class RestaurantContactHourSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantHour
        fields = ["weekday", "open_time", "close_time", "is_closed"]


class OrderRestaurantContactSerializer(serializers.Serializer):
    name = serializers.CharField()
    phone = serializers.CharField(allow_blank=True)
    email = serializers.CharField(allow_blank=True)
    address = serializers.CharField(allow_blank=True)
    logo_url = serializers.CharField(allow_blank=True)
    hours = RestaurantContactHourSerializer(many=True)


class OrderChatMessageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    image_download_url = serializers.SerializerMethodField()

    class Meta:
        model = OrderChatMessage
        fields = [
            "id",
            "sender_kind",
            "sender_label",
            "body",
            "image_url",
            "image_download_url",
            "image_purged",
            "created_at",
            "read_by_customer_at",
            "read_by_restaurant_at",
        ]

    def get_image_url(self, obj):
        if not obj.image:
            return ""
        request = self.context.get("request")
        image_path = f"/api/orders/chat/messages/{obj.id}/image/?inline=1"
        if request is not None:
            tracking_code = (request.query_params.get("tracking_code") or "").strip()
            if tracking_code:
                image_path = f"{image_path}&tracking_code={tracking_code}"
        if request is None:
            return image_path
        return request.build_absolute_uri(image_path)

    def get_image_download_url(self, obj):
        if not obj.image:
            return ""
        request = self.context.get("request")
        image_path = f"/api/orders/chat/messages/{obj.id}/image/"
        if request is not None:
            tracking_code = (request.query_params.get("tracking_code") or "").strip()
            if tracking_code:
                image_path = f"{image_path}?tracking_code={tracking_code}"
        if request is None:
            return image_path
        return request.build_absolute_uri(image_path)


class OrderChatDetailSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()
    unread_count_for_me = serializers.SerializerMethodField()

    class Meta:
        model = OrderChat
        fields = [
            "id",
            "order_id",
            "is_closed",
            "closed_at",
            "images_purged_at",
            "unread_count_for_me",
            "messages",
        ]

    def get_messages(self, obj):
        request = self.context.get("request")
        messages = obj.messages.select_related("sender_user").order_by("-created_at")[:50]
        ordered_messages = list(reversed(list(messages)))
        return OrderChatMessageSerializer(
            ordered_messages,
            many=True,
            context={"request": request},
        ).data

    def get_unread_count_for_me(self, obj) -> int:
        request = self.context.get("request")
        if not request:
            return 0

        order = obj.order
        user = request.user
        is_restaurant_side = bool(
            user.is_authenticated
            and user.id != order.user_id
            and (
                user.owned_restaurants.filter(id=order.restaurant_id).exists()
                or getattr(getattr(user, "operador", None), "restaurante_id", None)
                == order.restaurant_id
            )
        )

        if is_restaurant_side:
            return obj.messages.filter(
                sender_kind__in=[
                    OrderChatMessage.SenderKind.CUSTOMER,
                    OrderChatMessage.SenderKind.GUEST,
                ],
                read_by_restaurant_at__isnull=True,
            ).count()

        return obj.messages.filter(
            sender_kind=OrderChatMessage.SenderKind.RESTAURANT,
            read_by_customer_at__isnull=True,
        ).count()


class OrderChatMessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    image = serializers.FileField(required=False, allow_null=True)
    tracking_code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        body = (attrs.get("body") or "").strip()
        image = attrs.get("image")
        if not body and not image:
            raise serializers.ValidationError("El mensaje requiere texto o imagen.")
        attrs["body"] = body
        return attrs


class OrderChatReadSerializer(serializers.Serializer):
    tracking_code = serializers.CharField(required=False, allow_blank=True)


class PlatformChatConfigSerializer(serializers.Serializer):
    chat_images_enabled = serializers.BooleanField()
    chat_image_max_mb = serializers.IntegerField()
    chat_image_allowed_mimes = serializers.ListField(child=serializers.CharField())
    chat_post_close_purge_hours = serializers.IntegerField()
