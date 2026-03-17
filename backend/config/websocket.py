from channels.routing import URLRouter

from apps.orders.middleware import QueryStringJWTAuthMiddleware
from apps.orders.routing import websocket_urlpatterns


websocket_application = QueryStringJWTAuthMiddleware(URLRouter(websocket_urlpatterns))
