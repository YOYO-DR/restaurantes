import django.db.models.deletion
from django.db import migrations
from django.db import models


def drop_old_subscription_plan_fk(apps, schema_editor):
    """Drop the FK constraint from restaurants.subscription_plan_id → platform_subscription_plans.
    Finds the constraint name dynamically to work across all environments.
    """
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            SELECT con.conname
            FROM pg_constraint con
            JOIN pg_class tbl ON tbl.oid = con.conrelid
            JOIN pg_attribute att
                ON att.attrelid = tbl.oid
                AND att.attnum = ANY(con.conkey)
            WHERE tbl.relname = 'restaurants'
              AND att.attname = 'subscription_plan_id'
              AND con.contype = 'f'
            LIMIT 1
        """)
        row = cursor.fetchone()

    if row:
        constraint_name = row[0]
        schema_editor.execute(f'ALTER TABLE restaurants DROP CONSTRAINT "{constraint_name}"')


def update_restaurant_plan_ids(apps, schema_editor):
    """Set subscription_plan_id to the matching billing.Plan, matched by code.
    Uses raw SQL so Django ORM FK checks are bypassed entirely.
    Restaurants whose old plan code has no match in billing get the free plan.
    """
    schema_editor.execute("""
        UPDATE restaurants r
        SET subscription_plan_id = bp.id
        FROM platform_subscription_plans psp
        JOIN billing_plans bp ON bp.code = psp.code
        WHERE r.subscription_plan_id = psp.id
    """)

    # Assign free plan to any restaurant still pointing at an unknown plan
    schema_editor.execute("""
        UPDATE restaurants
        SET subscription_plan_id = (
            SELECT id FROM billing_plans
            WHERE is_free = true AND is_active = true
            LIMIT 1
        )
        WHERE subscription_plan_id NOT IN (SELECT id FROM billing_plans)
    """)


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("restaurants", "0008_new_operator_modules_defaults"),
        ("billing", "0003_data_migrate_subscription_plans"),
    ]

    operations = [
        # 1. Drop old FK (pointing to platform_subscription_plans) so we can freely update the column
        migrations.RunPython(drop_old_subscription_plan_fk, migrations.RunPython.noop),

        # 2. Update subscription_plan_id values to billing.Plan PKs (raw SQL, no ORM FK check)
        migrations.RunPython(update_restaurant_plan_ids, reverse_noop),

        # 3. Add new FK constraint pointing to billing.Plan
        migrations.AlterField(
            model_name="restaurant",
            name="subscription_plan",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="restaurants",
                to="billing.plan",
            ),
        ),
    ]
