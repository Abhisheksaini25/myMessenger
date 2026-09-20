"""Seed the gallery with the happynewyear default site and the packaged
opus-birthday site as the current /birthday site — so /gallery and /birthday
work the day this ships, without manual setup."""
from pathlib import Path

from django.conf import settings
from django.db import migrations


def seed(apps, schema_editor):
    GallerySite = apps.get_model("gallery", "GallerySite")
    sites_dir = Path(settings.BASE_DIR) / "sites"

    if (sites_dir / "happynewyear").is_dir() and not GallerySite.objects.filter(
        slug="happynewyear"
    ).exists():
        GallerySite.objects.create(
            slug="happynewyear",
            nick_name="Happy New Year",
            is_default=True,
            sort_order=0,
        )

    if (sites_dir / "opus-birthday").is_dir() and not GallerySite.objects.filter(
        slug="opus-birthday"
    ).exists():
        GallerySite.objects.create(
            slug="opus-birthday",
            nick_name="A Birthday Wish",
            is_current=True,
            sort_order=1,
        )


def unseed(apps, schema_editor):
    GallerySite = apps.get_model("gallery", "GallerySite")
    GallerySite.objects.filter(
        slug__in=["happynewyear", "opus-birthday"], person__isnull=True
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("gallery", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
