FEATURES_CATALOG = [
    {"code": "menu",           "name": "Menú Digital",        "category": "operaciones", "sort_order": 1},
    {"code": "pedidos",        "name": "Pedidos",              "category": "operaciones", "sort_order": 2},
    {"code": "inventario",     "name": "Inventario",           "category": "operaciones", "sort_order": 3},
    {"code": "clientes",       "name": "Clientes",             "category": "operaciones", "sort_order": 4},
    {"code": "lealtad",        "name": "Programa de Lealtad",  "category": "marketing",   "sort_order": 5},
    {"code": "resenas",        "name": "Reseñas",              "category": "marketing",   "sort_order": 6},
    {"code": "analiticas",     "name": "Analíticas",           "category": "analisis",    "sort_order": 7},
    {"code": "qr",             "name": "Códigos QR",           "category": "herramientas","sort_order": 8},
    {"code": "personalizacion","name": "Personalización",      "category": "herramientas","sort_order": 9},
    {"code": "configuracion",  "name": "Configuración",        "category": "herramientas","sort_order": 10},
    {"code": "operadores",     "name": "Operadores",           "category": "equipo",      "sort_order": 11},
]

FEATURE_DEPENDENCIES = [
    ("lealtad", "clientes"),
]
