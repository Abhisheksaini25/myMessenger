from django.contrib import admin

from .models import GalleryPerson, GallerySite


@admin.register(GalleryPerson)
class GalleryPersonAdmin(admin.ModelAdmin):
    list_display = ("nick_name", "dob", "number", "passcode", "created_at")
    search_fields = ("nick_name", "passcode")


@admin.register(GallerySite)
class GallerySiteAdmin(admin.ModelAdmin):
    list_display = (
        "nick_name",
        "slug",
        "person",
        "occasion_date",
        "is_default",
        "is_current",
        "sort_order",
    )
    list_filter = ("is_default", "is_current")
