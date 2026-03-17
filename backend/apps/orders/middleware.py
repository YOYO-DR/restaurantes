from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.exceptions import TokenError


@database_sync_to_async
def get_user_from_token(token: str):
    authenticator = JWTAuthentication()
    validated_token = authenticator.get_validated_token(token)
    return authenticator.get_user(validated_token)


class QueryStringJWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        close_old_connections()
        query_string = scope.get("query_string", b"").decode()
        access_token = parse_qs(query_string).get("access_token", [None])[0]

        if access_token:
            try:
                scope["user"] = await get_user_from_token(access_token)
            except (AuthenticationFailed, InvalidToken, TokenError):
                scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)
