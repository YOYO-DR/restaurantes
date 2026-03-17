from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CustomAuthConfig(AppConfig):
    name = "apps.custom_auth"
    verbose_name = _("Custom Auth")
