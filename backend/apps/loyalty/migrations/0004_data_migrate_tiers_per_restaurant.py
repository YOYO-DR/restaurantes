from django.db import migrations


def clone_global_tiers_to_restaurants(apps, schema_editor):
    LoyaltyTier = apps.get_model("loyalty", "LoyaltyTier")
    Restaurant = apps.get_model("restaurants", "Restaurant")

    global_tiers = list(LoyaltyTier.objects.filter(restaurant__isnull=True).order_by("min_points"))
    if not global_tiers:
        return

    for restaurant in Restaurant.objects.all().iterator():
        for tier in global_tiers:
            LoyaltyTier.objects.get_or_create(
                restaurant_id=restaurant.id,
                code=tier.code,
                defaults={
                    "name": tier.name,
                    "is_active": tier.is_active,
                    "min_points": tier.min_points,
                    "max_points": tier.max_points,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("loyalty", "0003_alter_loyaltytier_options_loyaltyredemption_order_and_more"),
    ]

    operations = [
        migrations.RunPython(clone_global_tiers_to_restaurants, migrations.RunPython.noop),
    ]
