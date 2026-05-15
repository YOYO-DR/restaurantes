from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class MenuConfig(AppConfig):
    name = "apps.menu"
    verbose_name = _("Menu")

    def ready(self):
        from apps.menu import signals  # noqa: F401
