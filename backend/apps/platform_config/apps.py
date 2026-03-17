from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class PlatformConfigConfig(AppConfig):
    name = "apps.platform_config"
    verbose_name = _("Platform Config")
