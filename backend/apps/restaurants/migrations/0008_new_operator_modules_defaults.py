from django.db import migrations


NEW_MODULES = {
    "qr":             {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    "personalizacion":{"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
    "configuracion":  {"can_view": False, "can_create": False, "can_edit": False, "can_delete": False},
}


def add_new_module_permissions(apps, schema_editor):
    Operador = apps.get_model("restaurants", "Operador")
    OperatorPermission = apps.get_model("restaurants", "OperatorPermission")

    for operador in Operador.objects.all():
        for module, defaults in NEW_MODULES.items():
            OperatorPermission.objects.get_or_create(
                operator=operador,
                module=module,
                defaults=defaults,
            )


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0007_operator_permission_invitation"),
    ]

    operations = [
        migrations.RunPython(add_new_module_permissions, migrations.RunPython.noop),
    ]
