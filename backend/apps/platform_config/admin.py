from django.contrib import admin

from apps.platform_config.models import BackupFrequency
from apps.platform_config.models import BillingPeriod
from apps.platform_config.models import PlatformSecuritySetting
from apps.platform_config.models import PlatformSetting
from apps.platform_config.models import SubscriptionPlan


admin.site.register(BackupFrequency)
admin.site.register(BillingPeriod)
admin.site.register(PlatformSecuritySetting)
admin.site.register(PlatformSetting)
admin.site.register(SubscriptionPlan)
