from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class LoyaltyConfig(AppConfig):
    name = "apps.loyalty"
    verbose_name = _("Loyalty")
