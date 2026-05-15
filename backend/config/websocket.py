from channels.security.websocket import AllowedHostsOriginValidator
from channels.routing import URLRouter

from apps.orders.middleware import QueryStringJWTAuthMiddleware
from apps.notifications.routing import websocket_urlpatterns

websocket_application = AllowedHostsOriginValidator(
    QueryStringJWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
)
