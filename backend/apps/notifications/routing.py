from django.urls import re_path

from apps.notifications.consumers import SessionNotificationsConsumer
from apps.order_chat.consumers import OrderChatConsumer
from apps.orders.consumers import GuestOrderConsumer

websocket_urlpatterns = [
    re_path(r"api/ws/notifications/$", SessionNotificationsConsumer.as_asgi()),
    re_path(r"api/ws/guest-orders/(?P<order_id>[0-9a-f-]+)/$", GuestOrderConsumer.as_asgi()),
    re_path(r"api/ws/orders/(?P<order_id>[0-9a-f-]+)/chat/$", OrderChatConsumer.as_asgi()),
]
