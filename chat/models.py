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


class Memo(models.Model):
    """
    One-way private note sent by a ChatUser, visible only to the admin.

    Unlike Message, Memo has no receiver field — all memos are implicitly
    addressed to admin. The sender can POST but never read back.
    """

    id = models.BigAutoField(primary_key=True)
    sender = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="sent_memos",
        help_text="The ChatUser who submitted this memo.",
    )
    text = models.TextField(
        blank=True,
        default="",
        help_text="Content of the memo.",
    )
    image = models.ImageField(
        upload_to="memos/",
        null=True,
        blank=True,
        help_text="Optional image attachment.",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )
    seen = models.BooleanField(
        default=False,
        help_text="Whether the admin has read this memo.",
    )

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Memo"
        verbose_name_plural = "Memos"

    def __str__(self) -> str:
        snippet = (self.text[:40] + "...") if len(self.text) > 40 else self.text
        return f"[Memo] {self.sender.user_id}: {snippet}"


class PeerChatPermission(models.Model):
    """
    Explicit admin permission allowing a ChatUser to discover and chat with another peer ChatUser.
    Managed only by Administrator via the Control Panel.
    """

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="allowed_peers",
        help_text="The user granted permission to chat.",
    )
    peer = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="allowed_by_peers",
        help_text="The peer user they are allowed to message.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["user__display_name", "peer__display_name"]
        unique_together = ("user", "peer")
        verbose_name = "Peer Chat Permission"
        verbose_name_plural = "Peer Chat Permissions"

    def __str__(self) -> str:
        return f"{self.user.user_id} -> {self.peer.user_id}"


class ChatGroup(models.Model):
    """
    Model representing a group chat created and managed by the administrator.
    Members are assigned based on their ChatUser / API key.
    """

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=100, help_text="Human-readable group name.")
    slug = models.SlugField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique group slug identifier for URLs and API calls.",
    )
    description = models.TextField(blank=True, default="", help_text="Optional description.")
    icon = models.ImageField(upload_to="group_icons/", null=True, blank=True, help_text="Optional group icon.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, help_text="Whether this group is active.")

    class Meta:
        ordering = ["name"]
        verbose_name = "Chat Group"
        verbose_name_plural = "Chat Groups"

    def __str__(self) -> str:
        return f"{self.name} ({self.slug})"

    @property
    def member_count(self) -> int:
        return self.memberships.count()


class GroupMembership(models.Model):
    """
    Represents a ChatUser's membership within a ChatGroup.
    Tracks individual read receipt status (last_read_message_id).
    """

    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(
        ChatGroup,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    is_admin = models.BooleanField(default=False, help_text="Group admin flag.")
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_message_id = models.BigIntegerField(
        default=0,
        help_text="Tracks the highest message ID read by this member.",
    )

    class Meta:
        ordering = ["joined_at"]
        unique_together = ("group", "user")
        verbose_name = "Group Membership"
        verbose_name_plural = "Group Memberships"

    def __str__(self) -> str:
        return f"{self.user.user_id} in {self.group.name}"


class GroupMessage(models.Model):
    """
    A message sent inside a ChatGroup.
    """

    id = models.BigAutoField(primary_key=True)
    group = models.ForeignKey(
        ChatGroup,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    sender = models.ForeignKey(
        ChatUser,
        on_delete=models.CASCADE,
        related_name="sent_group_messages",
    )
    message_type = models.CharField(
        max_length=10,
        choices=MessageType.choices,
        default=MessageType.TEXT,
    )
    text = models.TextField(blank=True, default="", help_text="Group message content.")
    image = models.ImageField(upload_to="group_messages/", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Group Message"
        verbose_name_plural = "Group Messages"

    def __str__(self) -> str:
        snippet = (self.text[:30] + "...") if len(self.text) > 30 else self.text
        return f"[{self.group.slug}] {self.sender.user_id}: {snippet}"

