from django.utils import timezone
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.permissions import IsAuthenticatedUser
from apps.notifications.api.serializers import NotificationEventSerializer
from apps.notifications.api.serializers import UserNotificationPreferenceSerializer
from apps.notifications.models import NotificationChannel
from apps.notifications.models import NotificationEvent
from apps.notifications.models import NotificationType
from apps.notifications.models import UserNotificationPreference


class UserNotificationPreferenceViewSet(GenericViewSet):
    permission_classes = [IsAuthenticatedUser]

    def list(self, request):
        ensure_default_notification_preferences(request.user)
        queryset = UserNotificationPreference.objects.filter(user=request.user).select_related(
            "notification_channel",
            "notification_type",
        )
        return Response(UserNotificationPreferenceSerializer(queryset, many=True).data)

    def partial_update(self, request, pk=None):
        preference = UserNotificationPreference.objects.filter(
            user=request.user,
            pk=pk,
        ).first()
        if not preference:
            return Response({"detail": "Preferencia no encontrada."}, status=404)

        preference.is_enabled = bool(request.data.get("is_enabled", preference.is_enabled))
        preference.save(update_fields=["is_enabled", "updated_at"])
        return Response(UserNotificationPreferenceSerializer(preference).data)


class NotificationCenterViewSet(GenericViewSet):
    permission_classes = [IsAuthenticatedUser]

    def list(self, request):
        ensure_default_notification_preferences(request.user)
        events_queryset = NotificationEvent.objects.filter(user=request.user).select_related(
            "notification_type",
        ).order_by("-created_at")
        unread_count = events_queryset.filter(read_at__isnull=True).count()
        return Response(
            {
                "unread_count": unread_count,
                "items": NotificationEventSerializer(events_queryset[:20], many=True).data,
            },
        )

    def create(self, request):
        type_code = request.data.get("type_code", "general")
        payload = request.data.get("payload_json") or {"title": "Notificacion"}

        role = request.user.account_roles.select_related("role").first()
        role_obj = role.role if role else None
        if role_obj is None:
            from apps.accounts.models import Role

            role_obj, _ = Role.objects.get_or_create(
                code="cliente",
                defaults={"name": "Cliente"},
            )

        notification_type, _ = NotificationType.objects.get_or_create(
            code=type_code,
            defaults={"name": type_code.replace("_", " ").title(), "audience_role": role_obj},
        )
        event = NotificationEvent.objects.create(
            user=request.user,
            notification_type=notification_type,
            payload_json=payload,
            sent_at=timezone.now(),
        )
        return Response(NotificationEventSerializer(event).data, status=201)

    def partial_update(self, request, pk=None):
        if pk != "mark-all-read":
            return Response({"detail": "Accion no soportada."}, status=404)
        NotificationEvent.objects.filter(user=request.user, read_at__isnull=True).update(
            read_at=timezone.now(),
        )
        return Response({"ok": True})


def ensure_default_notification_preferences(user) -> None:
    channels = {
        code: NotificationChannel.objects.get_or_create(code=code, defaults={"name": name})[0]
        for code, name in [
            ("email", "Correo"),
            ("push", "Push"),
            ("sms", "SMS"),
        ]
    }

    role = user.account_roles.select_related("role").first()
    role_obj = role.role if role else None
    if role_obj is None:
        from apps.accounts.models import Role

        role_obj, _ = Role.objects.get_or_create(code="cliente", defaults={"name": "Cliente"})

    types = {
        code: NotificationType.objects.get_or_create(
            code=code,
            defaults={"name": name, "audience_role": role_obj},
        )[0]
        for code, name in [
            ("order_updates", "Actualizaciones de pedidos"),
            ("promotions", "Promociones"),
            ("newsletter", "Newsletter"),
        ]
    }

    defaults = [
        ("email", "order_updates", True),
        ("push", "order_updates", True),
        ("sms", "order_updates", False),
        ("email", "promotions", True),
        ("push", "promotions", True),
        ("email", "newsletter", False),
    ]
    for channel_code, type_code, enabled in defaults:
        UserNotificationPreference.objects.get_or_create(
            user=user,
            notification_channel=channels[channel_code],
            notification_type=types[type_code],
            defaults={"is_enabled": enabled},
        )
