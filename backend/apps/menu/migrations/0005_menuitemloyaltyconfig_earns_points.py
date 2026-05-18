from django.db import migrations
from django.db import models


def backfill_earns_points_forward(apps, schema_editor):
    MenuItem = apps.get_model("menu", "MenuItem")
    MenuItemLoyaltyConfig = apps.get_model("menu", "MenuItemLoyaltyConfig")

    MenuItemLoyaltyConfig.objects.filter(
        allows_points_redemption=True,
    ).update(earns_points=True)

    menu_item_ids_with_config = MenuItemLoyaltyConfig.objects.values_list(
        "menu_item_id",
        flat=True,
    )
    missing_items = MenuItem.objects.exclude(id__in=menu_item_ids_with_config)
    MenuItemLoyaltyConfig.objects.bulk_create(
        [
            MenuItemLoyaltyConfig(
                menu_item=item,
                earns_points=True,
                allows_points_redemption=False,
                min_points_redeemable=0,
                max_points_redeemable=None,
            )
            for item in missing_items
        ],
        batch_size=500,
    )


def backfill_earns_points_reverse(apps, schema_editor):
    MenuItemLoyaltyConfig = apps.get_model("menu", "MenuItemLoyaltyConfig")
    MenuItemLoyaltyConfig.objects.update(earns_points=False)


class Migration(migrations.Migration):
    dependencies = [
        ("menu", "0004_menuitemloyaltyconfig"),
    ]

    operations = [
        migrations.AddField(
            model_name="menuitemloyaltyconfig",
            name="earns_points",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(
            backfill_earns_points_forward,
            backfill_earns_points_reverse,
        ),
    ]
