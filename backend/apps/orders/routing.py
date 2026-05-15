from django.urls import re_path

from apps.orders.consumers import GuestOrderConsumer

websocket_urlpatterns = [
    re_path(
        r"api/ws/guest-orders/(?P<order_id>[0-9a-f-]+)/$",
        GuestOrderConsumer.as_asgi(),
    ),
]
