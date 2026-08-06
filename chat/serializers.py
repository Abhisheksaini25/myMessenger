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
    """

    text = serializers.CharField(max_length=5000, allow_blank=False)
    message_type = serializers.CharField(
        max_length=10,
        default="TEXT",
        required=False,
    )
