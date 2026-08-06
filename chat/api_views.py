"""
REST API views for the chat app.

Implements endpoints for Android client messaging:
- GET /api/messages/
- GET /api/messages/latest/?after=ID
- POST /api/messages/send/
- POST /api/messages/seen/
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from chat.models import MessageType
from chat.serializers import MessageSerializer, MessageSendSerializer
from chat.services import (
    get_user_conversation,
    mark_messages_seen_by_user,
    send_message_to_admin,
)


class MessageListView(APIView):
    """
    GET /api/messages/

    Returns all conversation messages between admin and current user.
    Ordered oldest to newest.
    """

    def get(self, request, *args, **kwargs) -> Response:
        """Return full conversation history."""
        messages = get_user_conversation(request.chat_user)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MessageLatestView(APIView):
    """
    GET /api/messages/latest/?after=ID

    Returns only messages newer than ID between admin and current user.
    Ordered oldest to newest.
    """

    def get(self, request, *args, **kwargs) -> Response:
        """Return messages newer than after_id."""
        after_param = request.query_params.get("after")
        after_id = None
        if after_param is not None:
            try:
                after_id = int(after_param)
            except ValueError:
                return Response(
                    {"detail": "The 'after' parameter must be a valid integer ID."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        messages = get_user_conversation(request.chat_user, after_id=after_id)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MessageSendView(APIView):
    """
    POST /api/messages/send/

    Current user sends a message to admin.
    """

    def post(self, request, *args, **kwargs) -> Response:
        """Handle incoming message from Android client."""
        serializer = MessageSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        message = send_message_to_admin(
            sender=request.chat_user,
            text=serializer.validated_data["text"],
            message_type=serializer.validated_data.get("message_type", MessageType.TEXT),
        )
        response_serializer = MessageSerializer(message)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MessageSeenView(APIView):
    """
    POST /api/messages/seen/

    Marks messages from admin as seen.
    """

    def post(self, request, *args, **kwargs) -> Response:
        """Mark unread messages from admin to current user as seen."""
        count = mark_messages_seen_by_user(request.chat_user)
        return Response(
            {"status": "ok", "marked_seen": count},
            status=status.HTTP_200_OK,
        )
