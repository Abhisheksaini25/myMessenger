"""
DRF Serializers for the chat app.

Exposes only required non-sensitive message fields. Never exposes api_key.
"""
from rest_framework import serializers
from chat.models import Message
from users.models import ChatUser


class MessageSerializer(serializers.ModelSerializer):
    """
    Serializer for Message model.
    
    Exposes only id, sender, receiver, text, created_at, seen, delivered.
    Sender and receiver are serialized as their unique user_id strings.
    """

    sender = serializers.SlugRelatedField(
        slug_field="user_id",
        read_only=True,
    )
    receiver = serializers.SlugRelatedField(
        slug_field="user_id",
        read_only=True,
    )

    class Meta:
        model = Message
        fields = (
            "id",
            "sender",
            "receiver",
            "text",
            "created_at",
            "seen",
            "delivered",
        )
        read_only_fields = fields


class MessageSendSerializer(serializers.Serializer):
    """
    Serializer for validating payload when sending a message from Android.
    Defaults receiver to 'admin' for 100% backward compatibility.
    """

    text = serializers.CharField(max_length=5000, allow_blank=False)
    message_type = serializers.CharField(
        max_length=10,
        default="TEXT",
        required=False,
    )
    receiver = serializers.CharField(
        max_length=50,
        default="admin",
        required=False,
    )


class ContactSerializer(serializers.Serializer):
    """Serializer for allowed contacts returned by /api/contacts/."""

    user_id = serializers.CharField()
    display_name = serializers.CharField()
    is_admin = serializers.BooleanField(default=False)
    last_seen = serializers.DateTimeField(allow_null=True)
    profile_photo = serializers.ImageField(allow_null=True, required=False)


class ChatGroupSerializer(serializers.ModelSerializer):
    """Serializer for group list in /api/groups/."""

    member_count = serializers.IntegerField(read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        from chat.models import ChatGroup

        model = ChatGroup
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "icon",
            "created_at",
            "member_count",
            "last_message",
            "unread_count",
        )

    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at", "-id").first()
        if last:
            return {
                "id": last.id,
                "sender": last.sender.user_id,
                "sender_name": last.sender.display_name,
                "text": last.text,
                "message_type": last.message_type,
                "created_at": last.created_at,
            }
        return None

    def get_unread_count(self, obj):
        user = self.context.get("request_user")
        if not user:
            return 0
        membership = obj.memberships.filter(user=user).first()
        if not membership:
            return 0
        return obj.messages.filter(id__gt=membership.last_read_message_id).count()


class GroupMessageSerializer(serializers.ModelSerializer):
    """Serializer for individual messages in a group."""

    sender = serializers.SlugRelatedField(slug_field="user_id", read_only=True)
    sender_name = serializers.CharField(source="sender.display_name", read_only=True)
    group = serializers.SlugRelatedField(slug_field="slug", read_only=True)

    class Meta:
        from chat.models import GroupMessage

        model = GroupMessage
        fields = (
            "id",
            "group",
            "sender",
            "sender_name",
            "message_type",
            "text",
            "image",
            "created_at",
        )
        read_only_fields = fields


class GroupMessageSendSerializer(serializers.Serializer):
    """Serializer for sending a message to a group."""

    text = serializers.CharField(max_length=5000, allow_blank=False)
    message_type = serializers.CharField(
        max_length=10,
        default="TEXT",
        required=False,
    )


class MemoSendSerializer(serializers.Serializer):
    """Serializer for validating memo submissions from Android."""

    text = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default=""
    )
    image = serializers.ImageField(required=False, allow_null=True)

    def validate(self, attrs):
        """Ensure at least one of text or image is provided."""
        text = attrs.get("text", "").strip()
        image = attrs.get("image")
        if not text and not image:
            raise serializers.ValidationError(
                "Either text or image (or both) must be provided."
            )
        return attrs

