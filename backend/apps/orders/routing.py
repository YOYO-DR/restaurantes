from django.urls import re_path

from apps.orders.consumers import GuestOrderConsumer
from apps.orders.consumers import OwnerOrderConsumer
from apps.orders.consumers import UserOrderConsumer

websocket_urlpatterns = [
    re_path(r"api/ws/orders/(?P<owner_id>[0-9a-f-]+)/$", OwnerOrderConsumer.as_asgi()),
    re_path(
        r"api/ws/user-orders/(?P<user_id>[0-9a-f-]+)/$",
        UserOrderConsumer.as_asgi(),
    ),
    re_path(
        r"api/ws/guest-orders/(?P<order_id>[0-9a-f-]+)/$",
        GuestOrderConsumer.as_asgi(),
    ),
]
