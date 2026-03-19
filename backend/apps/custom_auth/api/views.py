from django.conf import settings
from django.contrib.auth import login
from rest_framework import permissions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.permissions import IsAuthenticatedUser
from .serializers import LoginSerializer
from .serializers import LogoutSerializer
from .serializers import RefreshCookieSerializer
from .serializers import RegisterSerializer
from .serializers import UserMeSerializer
from .serializers import build_token_payload
from .serializers import get_user_from_refresh_token
from .serializers import validate_refresh_token


def _set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=settings.JWT_REFRESH_COOKIE_SECURE,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
        path=settings.JWT_REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_REFRESH_COOKIE_SAMESITE,
    )


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = build_token_payload(user)
        response = Response(
            {
                "user": UserMeSerializer(user).data,
                "access": tokens["access"],
            },
            status=status.HTTP_201_CREATED,
        )
        _set_refresh_cookie(response, tokens["refresh"])
        return response


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        tokens = build_token_payload(user)
        response = Response(
            {
                "user": UserMeSerializer(user).data,
                "access": tokens["access"],
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, tokens["refresh"])
        return response


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RefreshCookieSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        refresh_token = validate_refresh_token(serializer.validated_data["refresh"])
        user = get_user_from_refresh_token(refresh_token)

        refresh_token.blacklist()

        access_token = str(refresh_token.access_token)
        rotated_refresh = RefreshToken.for_user(user)
        response = Response({"access": access_token}, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, str(rotated_refresh))
        return response


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        refresh_token = validate_refresh_token(serializer.validated_data["refresh"])
        refresh_token.blacklist()

        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticatedUser]

    def get(self, request):
        serializer = UserMeSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
