from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.customers.models import CustomerAddress
from apps.orders.models import Order
from apps.orders.models import OrderFulfillment
from apps.orders.models import OrderItem
from apps.orders.models import OrderStatus
from apps.orders.models import OrderStatusHistory
from apps.orders.models import OrderType
from apps.orders.services import build_guest_tracking_code
from apps.orders.services import create_guest_customer_name
from apps.orders.services import notify_restaurant_new_order
from apps.orders.services import send_order_confirmation_email
from apps.restaurants.models import Restaurant
from apps.restaurants.models import RestaurantTable

User = get_user_model()


def get_order_type_by_code(code: str) -> OrderType:
    order_type = OrderType.objects.filter(code=code).first()
    if order_type is None:
        raise serializers.ValidationError(
            {"order_type": "La configuracion de tipos de pedido no esta disponible."},
        )
    return order_type


def get_new_order_status() -> OrderStatus:
    status = OrderStatus.objects.filter(code="new").first()
    if status is None:
        raise serializers.ValidationError(
            {"detail": "La configuracion de estados de pedido no esta disponible."},
        )
    return status


class CheckoutItemSerializer(serializers.Serializer):
    menu_item_id = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1)


class CheckoutSerializer(serializers.Serializer):
    restaurant_id = serializers.UUIDField()
    order_type = serializers.ChoiceField(choices=("delivery", "pickup", "table"))
    items = CheckoutItemSerializer(many=True)
    customer_notes = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    delivery_address_id = serializers.UUIDField(required=False, allow_null=True)
    table_id = serializers.UUIDField(required=False, allow_null=True)
    customer_name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=255,
    )
    customer_email = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )
    customer_phone = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=30,
    )
    delivery_address_text = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=255,
    )

    def validate(self, attrs):
        request = self.context["request"]
        is_authenticated = bool(request.user and request.user.is_authenticated)
        restaurant = Restaurant.objects.select_related(
            "delivery_setting",
            "order_capability",
        ).get(id=attrs["restaurant_id"])
        items = []
        subtotal = Decimal("0.00")

        for raw_item in attrs["items"]:
            menu_item = restaurant.menu_items.filter(
                id=raw_item["menu_item_id"],
            ).first()
            if menu_item is None or not menu_item.is_available:
                raise serializers.ValidationError(
                    "Uno de los productos no esta disponible.",
                )

            quantity = raw_item["quantity"]
            line_total = menu_item.price_amount * quantity
            subtotal += line_total
            items.append(
                {
                    "menu_item": menu_item,
                    "quantity": quantity,
                    "line_total": line_total,
                },
            )

        delivery_fee = Decimal("0.00")
        service_fee = Decimal("0.00")
        order_type = attrs["order_type"]
        capability = getattr(restaurant, "order_capability", None)

        if order_type == "delivery":
            if not capability or not capability.delivery_enabled:
                raise serializers.ValidationError(
                    "Este restaurante no tiene delivery activo.",
                )
            if is_authenticated:
                delivery_address_id = attrs.get("delivery_address_id")
                if not delivery_address_id:
                    raise serializers.ValidationError(
                        {
                            "delivery_address_id": "Selecciona una direccion para delivery.",
                        },
                    )
                delivery_address = CustomerAddress.objects.filter(
                    id=delivery_address_id,
                    user=request.user,
                ).first()
                if delivery_address is None:
                    raise serializers.ValidationError(
                        {"delivery_address_id": "La direccion seleccionada no existe."},
                    )
                attrs["delivery_address"] = delivery_address
                attrs["delivery_address_text"] = delivery_address.line1
            else:
                delivery_address_text = (
                    attrs.get("delivery_address_text") or ""
                ).strip()
                if not delivery_address_text:
                    raise serializers.ValidationError(
                        {"delivery_address_text": "Ingresa la direccion de entrega."},
                    )
                attrs["delivery_address_text"] = delivery_address_text
            delivery_fee = getattr(
                restaurant.delivery_setting,
                "delivery_fee_amount",
                Decimal("0.00"),
            )
        elif order_type == "pickup":
            if not capability or not capability.pickup_enabled:
                raise serializers.ValidationError("Este restaurante no permite pickup.")
        elif order_type == "table":
            if not capability or not capability.table_order_enabled:
                raise serializers.ValidationError(
                    "Este restaurante no permite pedidos en mesa.",
                )
            table_id = attrs.get("table_id")
            if not table_id:
                raise serializers.ValidationError({"table_id": "Selecciona una mesa."})
            table = RestaurantTable.objects.filter(
                id=table_id,
                restaurant=restaurant,
            ).first()
            if table is None:
                raise serializers.ValidationError({"table_id": "La mesa no existe."})
            attrs["table"] = table

        if not is_authenticated and order_type in {"delivery", "pickup"}:
            customer_email = (attrs.get("customer_email") or "").strip()
            customer_phone = (attrs.get("customer_phone") or "").strip()
            if not customer_email:
                raise serializers.ValidationError(
                    {"customer_email": "Ingresa un correo para continuar."},
                )
            if not customer_phone:
                raise serializers.ValidationError(
                    {"customer_phone": "Ingresa un numero de telefono para continuar."},
                )

        customer_name = (attrs.get("customer_name") or "").strip()
        customer_email = (attrs.get("customer_email") or "").strip()
        customer_phone = (attrs.get("customer_phone") or "").strip()

        if is_authenticated:
            profile = getattr(request.user, "profile", None)
            customer_name = customer_name or request.user.name or request.user.email
            customer_email = customer_email or request.user.email
            customer_phone = customer_phone or (profile.phone if profile else "")
        else:
            customer_name = customer_name or create_guest_customer_name(
                customer_email,
                customer_phone,
            )

        attrs["customer_name"] = customer_name
        attrs["customer_email"] = customer_email
        attrs["customer_phone"] = customer_phone
        attrs["customer_notes"] = (attrs.get("customer_notes") or "").strip()
        attrs["guest_tracking_code"] = (
            build_guest_tracking_code() if not is_authenticated else None
        )

        attrs["restaurant"] = restaurant
        attrs["validated_items"] = items
        attrs["subtotal_amount"] = subtotal
        attrs["delivery_fee_amount"] = delivery_fee
        attrs["service_fee_amount"] = service_fee
        attrs["total_amount"] = subtotal + delivery_fee + service_fee
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        order_type = get_order_type_by_code(validated_data["order_type"])
        status = get_new_order_status()
        next_count = (
            Order.objects.filter(restaurant=validated_data["restaurant"]).count() + 1
        )
        order_code = f"ORD-{next_count:04d}"

        order = Order.objects.create(
            order_code=order_code,
            user=request.user if request.user.is_authenticated else None,
            restaurant=validated_data["restaurant"],
            order_type=order_type,
            status=status,
            subtotal_amount=validated_data["subtotal_amount"],
            delivery_fee_amount=validated_data["delivery_fee_amount"],
            service_fee_amount=validated_data["service_fee_amount"],
            discount_amount=Decimal("0.00"),
            total_amount=validated_data["total_amount"],
            currency_code="COP",
            customer_notes=validated_data.get("customer_notes", ""),
            customer_name=validated_data.get("customer_name", ""),
            customer_email=validated_data.get("customer_email", ""),
            customer_phone=validated_data.get("customer_phone", ""),
            guest_tracking_code=validated_data.get("guest_tracking_code"),
        )

        for item in validated_data["validated_items"]:
            OrderItem.objects.create(
                order=order,
                menu_item=item["menu_item"],
                item_name_snapshot=item["menu_item"].name,
                unit_price_amount=item["menu_item"].price_amount,
                quantity=item["quantity"],
                line_total_amount=item["line_total"],
            )

        OrderFulfillment.objects.create(
            order=order,
            delivery_address=validated_data.get("delivery_address"),
            table=validated_data.get("table"),
            delivery_address_text=validated_data.get("delivery_address_text") or "",
            estimated_min_minutes=getattr(
                validated_data["restaurant"].delivery_setting,
                "estimated_min_minutes",
                None,
            ),
            estimated_max_minutes=getattr(
                validated_data["restaurant"].delivery_setting,
                "estimated_max_minutes",
                None,
            ),
        )

        OrderStatusHistory.objects.create(
            order=order,
            status=status,
            changed_by=request.user if request.user.is_authenticated else None,
        )

        notify_restaurant_new_order(order)
        send_order_confirmation_email(order)
        return order


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id",
            "item_name_snapshot",
            "unit_price_amount",
            "quantity",
            "line_total_amount",
        ]


class OrderSerializer(serializers.ModelSerializer):
    restaurant_name = serializers.CharField(
        source="restaurant.display_name",
        read_only=True,
    )
    status_code = serializers.CharField(source="status.code", read_only=True)
    status_name = serializers.CharField(source="status.name", read_only=True)
    order_type_code = serializers.CharField(source="order_type.code", read_only=True)
    order_type_name = serializers.CharField(source="order_type.name", read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    delivery_address_label = serializers.SerializerMethodField()
    table_number = serializers.SerializerMethodField()
    estimated_min_minutes = serializers.IntegerField(
        source="fulfillment.estimated_min_minutes",
        allow_null=True,
        read_only=True,
    )
    estimated_max_minutes = serializers.IntegerField(
        source="fulfillment.estimated_max_minutes",
        allow_null=True,
        read_only=True,
    )
    guest_tracking_code = serializers.SerializerMethodField()
    cancel_reason = serializers.SerializerMethodField()
    cancelled_by = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_code",
            "restaurant",
            "restaurant_name",
            "status_code",
            "status_name",
            "order_type_code",
            "order_type_name",
            "subtotal_amount",
            "delivery_fee_amount",
            "service_fee_amount",
            "discount_amount",
            "total_amount",
            "currency_code",
            "customer_name",
            "customer_email",
            "customer_phone",
            "customer_notes",
            "guest_tracking_code",
            "cancel_reason",
            "cancelled_by",
            "delivery_address_label",
            "table_number",
            "estimated_min_minutes",
            "estimated_max_minutes",
            "created_at",
            "items",
        ]

    def get_delivery_address_label(self, obj: Order) -> str:
        fulfillment = getattr(obj, "fulfillment", None)
        if not fulfillment:
            return ""
        if fulfillment.delivery_address:
            return fulfillment.delivery_address.line1
        return fulfillment.delivery_address_text

    def get_table_number(self, obj: Order) -> str:
        fulfillment = getattr(obj, "fulfillment", None)
        if not fulfillment or not fulfillment.table:
            return ""
        return fulfillment.table.table_number

    def get_guest_tracking_code(self, obj: Order) -> str:
        return str(obj.guest_tracking_code) if obj.guest_tracking_code else ""

    def get_cancel_reason(self, obj: Order) -> str:
        last_cancel_entry = self._get_last_cancel_entry(obj)
        return last_cancel_entry.comment if last_cancel_entry else ""

    def get_cancelled_by(self, obj: Order) -> str:
        last_cancel_entry = self._get_last_cancel_entry(obj)
        if not last_cancel_entry:
            return ""

        changed_by = getattr(last_cancel_entry, "changed_by", None)
        if changed_by is None:
            return "cliente invitado"

        if obj.restaurant.owner_id == changed_by.id:
            return "restaurante"

        return "cliente"

    def _get_last_cancel_entry(self, obj: Order):
        return (
            obj.status_history.filter(status__code="cancelled")
            .select_related("changed_by")
            .order_by("-changed_at")
            .first()
        )


class OwnerOrderStatusUpdateSerializer(serializers.Serializer):
    status_code = serializers.ChoiceField(choices=("preparing", "ready", "delivered"))


class OrderCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)
