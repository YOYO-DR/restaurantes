from django.contrib import admin

from apps.notifications.models import NotificationChannel
from apps.notifications.models import NotificationEvent
from apps.notifications.models import NotificationType
from apps.notifications.models import UserNotificationPreference


admin.site.register(NotificationChannel)
admin.site.register(NotificationEvent)
admin.site.register(NotificationType)
admin.site.register(UserNotificationPreference)
