from django.apps import AppConfig
from django.db.models.signals import post_migrate
from django.utils.translation import gettext_lazy as _


def seed_billing_catalogs(sender, **kwargs):
    if sender.name != "apps.billing":
        return
    from apps.billing.init_scripts.catalogs import ensure_billing_catalogs

    ensure_billing_catalogs()


class BillingConfig(AppConfig):
    name = "apps.billing"
    verbose_name = _("Billing")

    def ready(self):
        from apps.billing import signals  # noqa: F401

        post_migrate.connect(
            seed_billing_catalogs,
            sender=self,
            dispatch_uid="apps.billing.seed_billing_catalogs",
        )
