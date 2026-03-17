from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class RestaurantsConfig(AppConfig):
    name = "apps.restaurants"
    verbose_name = _("Restaurants")
