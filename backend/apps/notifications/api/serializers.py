from rest_framework import serializers

from apps.notifications.models import NotificationEvent
from apps.notifications.models import UserNotificationPreference


class UserNotificationPreferenceSerializer(serializers.ModelSerializer):
    channel_code = serializers.CharField(source="notification_channel.code", read_only=True)
    type_code = serializers.CharField(source="notification_type.code", read_only=True)

    class Meta:
        model = UserNotificationPreference
        fields = ["id", "channel_code", "type_code", "is_enabled"]


class NotificationEventSerializer(serializers.ModelSerializer):
    type_code = serializers.CharField(source="notification_type.code", read_only=True)

    class Meta:
        model = NotificationEvent
        fields = ["id", "type_code", "payload_json", "created_at", "read_at"]
