import pytest

from apps.billing.init_scripts.catalogs import ensure_billing_catalogs
from apps.billing.models import Feature
from apps.billing.models import FeatureDependency
from apps.billing.models import Plan
from apps.billing.models import TrialConfig
from apps.billing.models import TrialFeatureDefault


@pytest.mark.django_db
class TestEnsureBillingCatalogs:
    def test_creates_11_features(self):
        ensure_billing_catalogs()
        assert Feature.objects.filter(is_active=True).count() == 11

    def test_idempotent_double_run(self):
        ensure_billing_catalogs()
        ensure_billing_catalogs()
        assert Feature.objects.count() == 11

    def test_feature_codes_match_expected(self):
        ensure_billing_catalogs()
        codes = set(Feature.objects.values_list("code", flat=True))
        expected = {"menu", "pedidos", "inventario", "clientes", "lealtad", "resenas",
                    "analiticas", "qr", "personalizacion", "configuracion", "operadores"}
        assert expected == codes

    def test_lealtad_depends_on_clientes(self):
        ensure_billing_catalogs()
        lealtad = Feature.objects.get(code="lealtad")
        clientes = Feature.objects.get(code="clientes")
        assert FeatureDependency.objects.filter(feature=lealtad, depends_on=clientes).exists()

    def test_seed_plans_creates_free_plan(self):
        ensure_billing_catalogs()
        free = Plan.objects.get(code="free")
        assert free.is_free is True
        assert free.is_active is True

    def test_free_plan_features_view_only(self):
        ensure_billing_catalogs()
        free = Plan.objects.get(code="free")
        for pf in free.plan_features.all():
            assert pf.can_view is True
            assert pf.can_create is False
            assert pf.can_edit is False
            assert pf.can_delete is False

    def test_seed_plans_creates_default_trial_plan(self):
        ensure_billing_catalogs()
        trial = Plan.objects.get(code="trial")
        assert trial.is_default is True
        assert trial.is_active is True

    def test_trial_plan_features_full_access(self):
        ensure_billing_catalogs()
        trial = Plan.objects.get(code="trial")
        for pf in trial.plan_features.all():
            assert pf.can_view is True
            assert pf.can_create is True
            assert pf.can_edit is True

    def test_seed_trial_config_singleton_created(self):
        ensure_billing_catalogs()
        assert TrialConfig.objects.count() == 1
        config = TrialConfig.objects.first()
        assert config.default_trial_days == 14
        assert config.is_enabled is True

    def test_trial_config_has_11_feature_defaults(self):
        ensure_billing_catalogs()
        config = TrialConfig.objects.first()
        assert TrialFeatureDefault.objects.filter(trial_config=config).count() == 11
