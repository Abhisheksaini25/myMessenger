"""Django Admin configuration for chat app."""
from django.contrib import admin
from chat.models import Memo, Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Admin interface for Message."""

    list_display = (
        "id",
        "sender",
        "receiver",
        "message_type",
        "short_text",
        "seen",
        "delivered",
        "created_at",
    )
    list_filter = (
        "message_type",
        "seen",
        "delivered",
        "deleted_by_admin",
        "deleted_by_user",
        "created_at",
    )
    search_fields = (
        "text",
        "sender__user_id",
        "receiver__user_id",
        "sender__display_name",
        "receiver__display_name",
    )
    ordering = ("-created_at", "-id")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (
            "Message Info",
            {
                "fields": (
                    "sender",
                    "receiver",
                    "message_type",
                    "text",
                    "image",
                )
            },
        ),
        (
            "Status & Deletion",
            {
                "fields": (
                    "seen",
                    "delivered",
                    "deleted_by_admin",
                    "deleted_by_user",
                )
            },
        ),
        (
            "Timestamps",
            {
                "fields": ("created_at", "updated_at"),
            },
        ),
    )

    @admin.display(description="Text Preview")
    def short_text(self, obj: Message) -> str:
        """Return truncated preview of message text."""
        return (obj.text[:40] + "...") if len(obj.text) > 40 else obj.text


@admin.register(Memo)
class MemoAdmin(admin.ModelAdmin):
    """Admin interface for Memo."""

    list_display = ("id", "sender", "short_text", "seen", "created_at")
    list_filter = ("seen", "created_at")
    search_fields = ("text", "sender__user_id", "sender__display_name")
    ordering = ("-created_at",)
    readonly_fields = ("created_at",)

    @admin.display(description="Text Preview")
    def short_text(self, obj: Memo) -> str:
        return (obj.text[:50] + "...") if len(obj.text) > 50 else obj.text

