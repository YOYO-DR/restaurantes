from django.db import migrations


def copy_subscription_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("platform_config", "SubscriptionPlan")
    Plan = apps.get_model("billing", "Plan")

    for old_plan in SubscriptionPlan.objects.all():
        Plan.objects.update_or_create(
            code=old_plan.code,
            defaults={
                "name": old_plan.name,
                "description": getattr(old_plan, "description", ""),
                "billing_period_id": old_plan.billing_period_id,
                "price_amount": old_plan.price_amount,
                "currency_code": old_plan.currency_code,
                "is_free": False,
                "is_default": False,
                "is_active": old_plan.is_active,
                "sort_order": 0,
                "metadata": {"legacy_id": str(old_plan.pk)},
            },
        )


def reverse_copy(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0002_trial_config_constraints"),
        ("platform_config", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(copy_subscription_plans, reverse_copy),
    ]
