def ensure_billing_catalogs() -> None:
    _ensure_features()
    _ensure_feature_dependencies()
    _ensure_plans()
    _ensure_trial_config()


def _ensure_features() -> None:
    from apps.billing.init_scripts.seed_features import FEATURES_CATALOG
    from apps.billing.models import Feature

    for data in FEATURES_CATALOG:
        Feature.objects.update_or_create(code=data["code"], defaults=data)


def _ensure_feature_dependencies() -> None:
    from apps.billing.init_scripts.seed_features import FEATURE_DEPENDENCIES
    from apps.billing.models import Feature
    from apps.billing.models import FeatureDependency

    for feature_code, depends_on_code in FEATURE_DEPENDENCIES:
        try:
            feature = Feature.objects.get(code=feature_code)
            depends_on = Feature.objects.get(code=depends_on_code)
        except Feature.DoesNotExist:
            continue
        FeatureDependency.objects.get_or_create(feature=feature, depends_on=depends_on)


def _ensure_plans() -> None:
    from apps.billing.init_scripts.seed_plans import FREE_PLAN
    from apps.billing.init_scripts.seed_plans import FREE_PLAN_FEATURES
    from apps.billing.init_scripts.seed_plans import TRIAL_PLAN
    from apps.billing.init_scripts.seed_plans import TRIAL_PLAN_FEATURES
    from apps.billing.models import Feature
    from apps.billing.models import Plan
    from apps.billing.models import PlanFeature

    for plan_data, features_data in [
        (FREE_PLAN, FREE_PLAN_FEATURES),
        (TRIAL_PLAN, TRIAL_PLAN_FEATURES),
    ]:
        plan, _ = Plan.objects.update_or_create(
            code=plan_data["code"],
            defaults={k: v for k, v in plan_data.items() if k != "code"},
        )
        for feature_code, perms in features_data.items():
            try:
                feature = Feature.objects.get(code=feature_code)
            except Feature.DoesNotExist:
                continue
            PlanFeature.objects.update_or_create(
                plan=plan,
                feature=feature,
                defaults=perms,
            )


def _ensure_trial_config() -> None:
    from apps.billing.init_scripts.seed_plans import TRIAL_CONFIG
    from apps.billing.init_scripts.seed_plans import TRIAL_PLAN_FEATURES
    from apps.billing.models import Feature
    from apps.billing.models import Plan
    from apps.billing.models import TrialConfig
    from apps.billing.models import TrialFeatureDefault

    trial_plan = Plan.objects.filter(code="trial", is_active=True).first()

    config = TrialConfig.objects.first()
    if config is None:
        config = TrialConfig.objects.create(
            is_enabled=TRIAL_CONFIG["is_enabled"],
            default_trial_days=TRIAL_CONFIG["default_trial_days"],
            trial_plan=trial_plan,
        )
    else:
        config.is_enabled = TRIAL_CONFIG["is_enabled"]
        config.default_trial_days = TRIAL_CONFIG["default_trial_days"]
        if trial_plan and config.trial_plan_id != trial_plan.id:
            config.trial_plan = trial_plan
        config.save()

    for feature_code, perms in TRIAL_PLAN_FEATURES.items():
        try:
            feature = Feature.objects.get(code=feature_code)
        except Feature.DoesNotExist:
            continue
        TrialFeatureDefault.objects.update_or_create(
            trial_config=config,
            feature=feature,
            defaults=perms,
        )
