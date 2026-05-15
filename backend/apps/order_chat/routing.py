from django.urls import re_path

from apps.order_chat.consumers import OrderChatConsumer

websocket_urlpatterns = [
    re_path(
        r"api/ws/orders/(?P<order_id>[0-9a-f-]+)/chat/$",
        OrderChatConsumer.as_asgi(),
    ),
]
