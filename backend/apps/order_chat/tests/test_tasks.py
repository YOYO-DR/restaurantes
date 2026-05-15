from datetime import timedelta

import pytest
from django.utils import timezone

try:
    from freezegun import freeze_time
except ImportError:  # pragma: no cover
    freeze_time = None

from apps.order_chat.models import OrderChat
from apps.order_chat.models import OrderChatMessage
from apps.order_chat.tasks import purge_expired_chat_images_beat
from apps.order_chat.tasks import purge_order_chat_images
from apps.platform_config.models import PlatformSetting
from apps.restaurants.tests.factories import OrderStatusFactory
from apps.restaurants.tests.factories import OrderTypeFactory
from apps.restaurants.tests.factories import RestaurantFactory

from apps.orders.models import Order
from apps.orders.models import OrderStatusHistory

pytestmark = pytest.mark.django_db


def create_closed_order(status_code: str = "delivered"):
    restaurant = RestaurantFactory()
    order_type = OrderTypeFactory(code="pickup", name="Pickup")
    current_status = OrderStatusFactory(code=status_code, name=status_code.title())
    order = Order.objects.create(
        order_code=f"ORD-{status_code.upper()}-TASK",
        user=None,
        restaurant=restaurant,
        order_type=order_type,
        status=current_status,
        subtotal_amount="10000.00",
        delivery_fee_amount="0.00",
        service_fee_amount="0.00",
        discount_amount="0.00",
        total_amount="10000.00",
        currency_code="COP",
    )
    OrderStatusHistory.objects.create(order=order, status=current_status)
    chat, _ = OrderChat.objects.get_or_create(order=order)
    return order, chat


def test_purge_order_chat_images_closes_chat_and_flags_images():
    PlatformSetting.objects.create(platform_name="FoodHub", chat_post_close_purge_hours=24)
    order, chat = create_closed_order("delivered")
    OrderChatMessage.objects.create(
        chat=chat,
        sender_kind=OrderChatMessage.SenderKind.CUSTOMER,
        sender_label="Cliente",
        body="foto",
        image="order-chat/2026/05/test.jpg",
    )

    status_change = order.status_history.order_by("-changed_at").first()
    status_change.changed_at = timezone.now() - timedelta(hours=25)
    status_change.save(update_fields=["changed_at"])

    purge_order_chat_images(str(order.id))

    chat.refresh_from_db()
    message = chat.messages.first()
    assert chat.is_closed is True
    assert chat.images_purged_at is not None
    assert message.image_purged is True


def test_purge_order_chat_images_is_idempotent():
    PlatformSetting.objects.create(platform_name="FoodHub", chat_post_close_purge_hours=24)
    order, chat = create_closed_order("cancelled")

    status_change = order.status_history.order_by("-changed_at").first()
    status_change.changed_at = timezone.now() - timedelta(hours=30)
    status_change.save(update_fields=["changed_at"])

    purge_order_chat_images(str(order.id))
    first_purged_at = OrderChat.objects.get(id=chat.id).images_purged_at

    purge_order_chat_images(str(order.id))
    second_purged_at = OrderChat.objects.get(id=chat.id).images_purged_at

    assert first_purged_at == second_purged_at


def test_purge_beat_dispatches_for_expired_chats(monkeypatch):
    PlatformSetting.objects.create(platform_name="FoodHub", chat_post_close_purge_hours=24)
    order, _chat = create_closed_order("delivered")

    status_change = order.status_history.order_by("-changed_at").first()
    status_change.changed_at = timezone.now() - timedelta(hours=26)
    status_change.save(update_fields=["changed_at"])

    calls = []

    def fake_delay(order_id):
        calls.append(order_id)

    monkeypatch.setattr("apps.order_chat.tasks.purge_order_chat_images.delay", fake_delay)
    purge_expired_chat_images_beat()

    assert str(order.id) in calls


def test_purge_order_chat_images_respects_cutoff_with_freezegun():
    if freeze_time is None:
        pytest.skip("freezegun no esta instalado en el entorno")

    PlatformSetting.objects.create(platform_name="FoodHub", chat_post_close_purge_hours=24)

    with freeze_time("2026-05-10 10:00:00"):
        order, chat = create_closed_order("delivered")
        status_change = order.status_history.order_by("-changed_at").first()
        status_change.changed_at = timezone.now() - timedelta(hours=23)
        status_change.save(update_fields=["changed_at"])

        purge_order_chat_images(str(order.id))
        chat.refresh_from_db()
        assert chat.is_closed is False
