from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="avatar_file",
            field=models.FileField(blank=True, upload_to="user-avatars/"),
        ),
    ]
