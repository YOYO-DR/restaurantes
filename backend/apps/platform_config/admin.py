from django.contrib import admin

from apps.platform_config.models import BackupFrequency
from apps.platform_config.models import BillingPeriod
from apps.platform_config.models import PlatformSecuritySetting
from apps.platform_config.models import PlatformSetting
from apps.platform_config.models import SubscriptionPlan


@admin.register(PlatformSetting)
class PlatformSettingAdmin(admin.ModelAdmin):
    list_display = [
        "platform_name",
        "maintenance_mode",
        "chat_images_enabled",
        "chat_image_max_mb",
        "chat_post_close_purge_hours",
    ]


admin.site.register(BackupFrequency)
admin.site.register(BillingPeriod)
admin.site.register(PlatformSecuritySetting)
admin.site.register(SubscriptionPlan)
