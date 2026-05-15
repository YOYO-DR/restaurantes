from channels.routing import URLRouter

from apps.orders.middleware import QueryStringJWTAuthMiddleware
from apps.notifications.routing import websocket_urlpatterns

websocket_application = QueryStringJWTAuthMiddleware(URLRouter(websocket_urlpatterns))
