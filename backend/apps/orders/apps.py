from django.apps import AppConfig
from django.db.models.signals import post_migrate
from django.utils.translation import gettext_lazy as _


def seed_order_catalogs(sender, **kwargs):
    if sender.name != "apps.orders":
        return

    from apps.orders.init_scripts.catalogs import ensure_order_catalogs

    ensure_order_catalogs()


class OrdersConfig(AppConfig):
    name = "apps.orders"
    verbose_name = _("Orders")

    def ready(self):
        post_migrate.connect(
            seed_order_catalogs,
            sender=self,
            dispatch_uid="apps.orders.seed_order_catalogs",
        )
