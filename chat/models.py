"""
Models for the chat app.

Defines Message model representing one-to-one communication between
friends and the admin.
"""
from django.db import models
from users.models import ChatUser


class MessageType(models.TextChoices):
    """Allowed message types."""

    TEXT = "TEXT", "Text"
    IMAGE = "IMAGE", "Image"
    SYSTEM = "SYSTEM", "System"


class Message(models.Model):
    """
    Model representing a message exchanged between a ChatUser and admin.
    """

    id = models.BigAutoField(primary_key=True)
    sender = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="sent_messages",
        help_text="Sender of the message.",
    )
    receiver = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="received_messages",
        help_text="Receiver of the message.",
    )
    message_type = models.CharField(
        max_length=10,
        choices=MessageType.choices,
        default=MessageType.TEXT,
        help_text="Type of message (TEXT, IMAGE, SYSTEM).",
    )
    text = models.TextField(
        blank=True,
        default="",
        help_text="Text content of the message.",
    )
    image = models.ImageField(
        upload_to="messages/",
        null=True,
        blank=True,
        help_text="Optional image attachment.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="Timestamp when message was created.",
    )
    updated_at = models.DateTimeField(auto_now=True)
    seen = models.BooleanField(
        default=False,
        help_text="Whether the receiver has seen this message.",
    )
    delivered = models.BooleanField(
        default=False,
        help_text="Whether the receiver has received this message.",
    )
    deleted_by_admin = models.BooleanField(
        default=False,
        help_text="Whether the admin has soft-deleted this message.",
    )
    deleted_by_user = models.BooleanField(
        default=False,
        help_text="Whether the user has soft-deleted this message.",
    )

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Message"
        verbose_name_plural = "Messages"

    def __str__(self) -> str:
        snippet = (self.text[:30] + "...") if len(self.text) > 30 else self.text
        return f"[{self.message_type}] {self.sender.user_id} -> {self.receiver.user_id}: {snippet}"
