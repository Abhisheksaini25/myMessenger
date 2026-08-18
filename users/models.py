"""
Models for the users app.

Defines ChatUser which represents the Android APK friend accounts as well as
the dedicated admin record for consistent message foreign keys.
"""
from typing import Optional
from django.db import models


class ChatUser(models.Model):
    """
    Model representing a chat user in the one-to-one messaging platform.
    
    Includes friends using Android APKs as well as the special admin counterpart
    record with user_id="admin".
    """

    id = models.BigAutoField(primary_key=True)
    user_id = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Unique identifier sent in X-USER-ID header (e.g., 'friend1' or 'admin').",
    )
    display_name = models.CharField(
        max_length=100,
        help_text="Human-readable display name.",
    )
    api_key = models.CharField(
        max_length=128,
        unique=True,
        db_index=True,
        help_text="Secret API key sent in X-API-KEY header.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_seen = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this user is allowed to authenticate and message.",
    )
    profile_photo = models.ImageField(
        upload_to="profiles/",
        null=True,
        blank=True,
        help_text="Optional profile photo.",
    )
    fcm_token = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["display_name"]
        verbose_name = "Chat User"
        verbose_name_plural = "Chat Users"

    def __str__(self) -> str:
        return f"{self.display_name} ({self.user_id})"

    @classmethod
    def get_admin_user(cls) -> "ChatUser":
        """
        Fetch or create the dedicated admin ChatUser record.
        
        Ensures consistent ForeignKey relations for messages sent to/from the admin.
        """
        admin_user, _ = cls.objects.get_or_create(
            user_id="admin",
            defaults={
                "display_name": "Administrator",
                "api_key": "admin-internal-key-do-not-use-externally",
                "is_active": True,
            },
        )
        return admin_user
