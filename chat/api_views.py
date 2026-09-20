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
from chat.serializers import (
    ChatGroupSerializer,
    ContactSerializer,
    GroupMessageSendSerializer,
    GroupMessageSerializer,
    MessageSendSerializer,
    MessageSerializer,
)
from chat.services import (
    can_chat_with,
    get_allowed_contacts_for_user,
    get_group_messages,
    get_user_conversation,
    get_user_groups,
    mark_group_messages_seen,
    mark_messages_seen_by_user,
    send_group_message,
    send_message_to_admin,
    send_peer_message,
)
from users.models import ChatUser


class ContactListView(APIView):
    """
    GET /api/contacts/

    Returns all allowed contacts (Admin + admin-permitted peers) for the caller.
    """

    def get(self, request, *args, **kwargs) -> Response:
        contacts = get_allowed_contacts_for_user(request.chat_user)
        serializer = ContactSerializer(contacts, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MessageListView(APIView):
    """
    GET /api/messages/?user=<user_id>

    Returns conversation messages between request.chat_user and target user.
    Defaults to admin if 'user' is omitted (100% backward compatible).
    """

    def get(self, request, *args, **kwargs) -> Response:
        user_param = request.query_params.get("user")
        target_user = None
        if user_param and user_param != "admin":
            target_user = ChatUser.objects.filter(user_id=user_param, is_active=True).first()
            if not target_user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            if not can_chat_with(request.chat_user, target_user):
                return Response(
                    {"detail": "Permission denied to chat with this user."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        messages = get_user_conversation(request.chat_user, target_user=target_user)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MessageLatestView(APIView):
    """
    GET /api/messages/latest/?after=ID&user=<user_id>

    Returns only messages newer than ID between caller and target user (defaults to admin).
    """

    def get(self, request, *args, **kwargs) -> Response:
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

        user_param = request.query_params.get("user")
        target_user = None
        if user_param and user_param != "admin":
            target_user = ChatUser.objects.filter(user_id=user_param, is_active=True).first()
            if not target_user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            if not can_chat_with(request.chat_user, target_user):
                return Response(
                    {"detail": "Permission denied to chat with this user."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        messages = get_user_conversation(request.chat_user, after_id=after_id, target_user=target_user)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MessageSendView(APIView):
    """
    POST /api/messages/send/

    Sends a message to receiver ('admin' by default).
    Payload: {"text": "...", "receiver": "user_id" (optional)}
    """

    def post(self, request, *args, **kwargs) -> Response:
        serializer = MessageSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        receiver_id = serializer.validated_data.get("receiver", "admin")
        text = serializer.validated_data["text"]
        message_type = serializer.validated_data.get("message_type", MessageType.TEXT)

        if receiver_id == "admin":
            message = send_message_to_admin(
                sender=request.chat_user,
                text=text,
                message_type=message_type,
            )
        else:
            target_user = ChatUser.objects.filter(user_id=receiver_id, is_active=True).first()
            if not target_user:
                return Response({"detail": "Receiver not found."}, status=status.HTTP_404_NOT_FOUND)
            if not can_chat_with(request.chat_user, target_user):
                return Response(
                    {"detail": "Permission denied to chat with this user."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            message = send_peer_message(
                sender=request.chat_user,
                receiver=target_user,
                text=text,
                message_type=message_type,
            )

        response_serializer = MessageSerializer(message)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MessageSeenView(APIView):
    """
    POST /api/messages/seen/

    Marks incoming messages as seen.
    Payload: {"sender": "user_id" (optional, defaults to 'admin')}
    """

    def post(self, request, *args, **kwargs) -> Response:
        sender_id = request.data.get("sender") or request.query_params.get("sender")
        if sender_id and sender_id != "admin":
            from chat.models import Message

            target_user = ChatUser.objects.filter(user_id=sender_id, is_active=True).first()
            if not target_user:
                return Response({"detail": "Sender user not found."}, status=status.HTTP_404_NOT_FOUND)
            count = Message.objects.filter(
                sender=target_user, receiver=request.chat_user, seen=False
            ).update(seen=True)
        else:
            count = mark_messages_seen_by_user(request.chat_user)

        return Response(
            {"status": "ok", "marked_seen": count},
            status=status.HTTP_200_OK,
        )


class GroupListView(APIView):
    """
    GET /api/groups/

    Returns all active groups of which the authenticated user is a member.
    """

    def get(self, request, *args, **kwargs) -> Response:
        groups = get_user_groups(request.chat_user)
        serializer = ChatGroupSerializer(
            groups, many=True, context={"request_user": request.chat_user}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class GroupMessageListView(APIView):
    """
    GET /api/groups/<str:slug>/messages/?after=ID

    Returns messages in the specified group for member callers.
    """

    def get(self, request, slug: str, *args, **kwargs) -> Response:
        from chat.models import ChatGroup

        group = ChatGroup.objects.filter(slug=slug, is_active=True).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        after_param = request.query_params.get("after")
        after_id = None
        if after_param is not None:
            try:
                after_id = int(after_param)
            except ValueError:
                return Response(
                    {"detail": "Invalid 'after' parameter."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            messages = get_group_messages(group, request.chat_user, after_id=after_id)
        except PermissionError:
            return Response(
                {"detail": "You are not a member of this group."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GroupMessageSerializer(messages, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class GroupMessageSendView(APIView):
    """
    POST /api/groups/<str:slug>/send/

    Sends a message to the specified group.
    """

    def post(self, request, slug: str, *args, **kwargs) -> Response:
        from chat.models import ChatGroup

        group = ChatGroup.objects.filter(slug=slug, is_active=True).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = GroupMessageSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            msg = send_group_message(
                group=group,
                sender=request.chat_user,
                text=serializer.validated_data["text"],
                message_type=serializer.validated_data.get("message_type", MessageType.TEXT),
            )
        except PermissionError:
            return Response(
                {"detail": "You are not a member of this group."},
                status=status.HTTP_403_FORBIDDEN,
            )

        response_serializer = GroupMessageSerializer(msg)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class GroupMessageSeenView(APIView):
    """
    POST /api/groups/<str:slug>/seen/

    Marks all messages in the group up to current as seen by the caller.
    """

    def post(self, request, slug: str, *args, **kwargs) -> Response:
        from chat.models import ChatGroup

        group = ChatGroup.objects.filter(slug=slug, is_active=True).first()
        if not group:
            return Response({"detail": "Group not found."}, status=status.HTTP_404_NOT_FOUND)

        mark_group_messages_seen(group, request.chat_user)
        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class MemoSubmitView(APIView):
    """
    POST /api/sync/push/

    Android user submits a private memo. Only admin can read it.
    The user has no GET access — write-only.
    """

    def post(self, request, *args, **kwargs) -> Response:
        from chat.serializers import MemoSendSerializer
        from chat.services import create_memo

        serializer = MemoSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        memo = create_memo(
            sender=request.chat_user,
            text=serializer.validated_data.get("text", ""),
            image=serializer.validated_data.get("image"),
        )
        return Response(
            {"status": "ok", "id": memo.id},
            status=status.HTTP_201_CREATED,
        )

