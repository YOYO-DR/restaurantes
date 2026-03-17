from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class MenuConfig(AppConfig):
    name = "apps.menu"
    verbose_name = _("Menu")
