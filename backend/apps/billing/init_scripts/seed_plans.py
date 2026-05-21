from apps.billing.init_scripts.seed_features import FEATURES_CATALOG

FREE_PLAN = {
    "code": "free",
    "name": "Free",
    "description": "Plan gratuito con acceso de solo lectura a todas las funcionalidades.",
    "price_amount": "0.00",
    "currency_code": "COP",
    "is_free": True,
    "is_default": False,
    "is_active": True,
    "sort_order": 0,
}

FREE_PLAN_FEATURES = {
    feature["code"]: {"can_view": True, "can_create": False, "can_edit": False, "can_delete": False}
    for feature in FEATURES_CATALOG
}

TRIAL_PLAN = {
    "code": "trial",
    "name": "Trial",
    "description": "Plan de prueba gratuito con acceso completo por tiempo limitado.",
    "price_amount": "0.00",
    "currency_code": "COP",
    "is_free": False,
    "is_default": True,
    "is_active": True,
    "sort_order": 1,
}

TRIAL_PLAN_FEATURES = {
    feature["code"]: {"can_view": True, "can_create": True, "can_edit": True, "can_delete": True}
    for feature in FEATURES_CATALOG
}

TRIAL_CONFIG = {
    "is_enabled": True,
    "default_trial_days": 14,
}
