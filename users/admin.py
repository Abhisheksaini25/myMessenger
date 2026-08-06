"""Django Admin configuration for users app."""
from django.contrib import admin
from users.models import ChatUser


@admin.register(ChatUser)
class ChatUserAdmin(admin.ModelAdmin):
    """Admin interface for ChatUser."""

    list_display = (
        "id",
        "user_id",
        "display_name",
        "is_active",
        "last_seen",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("user_id", "display_name")
    ordering = ("display_name",)
    readonly_fields = ("created_at", "updated_at", "last_seen")
    fieldsets = (
        (
            "Account Info",
            {
                "fields": (
                    "user_id",
                    "display_name",
                    "api_key",
                    "is_active",
                    "profile_photo",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at", "last_seen"),
            },
        ),
    )
