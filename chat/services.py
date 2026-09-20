"""
Service functions for chat message operations.

Encapsulates database queries and messaging rules for both REST API
and HTMX Dashboard.
"""
import logging
from typing import List, Dict, Any, Optional
from django.db.models import Q, QuerySet
from chat.models import Message, MessageType
from users.models import ChatUser
from users.services import get_active_friends
from utils.firebase import send_push_notification

logger = logging.getLogger(__name__)


def can_chat_with(sender: ChatUser, target: ChatUser) -> bool:
    """
    Check if sender is authorized to message target.
    - Admin is always allowed to message anyone, and anyone can message Admin.
    - Peers can only message each other if an explicit PeerChatPermission exists.
    """
    if sender.user_id == "admin" or target.user_id == "admin":
        return True
    if sender.pk == target.pk:
        return False
    from chat.models import PeerChatPermission
    return PeerChatPermission.objects.filter(user=sender, peer=target).exists()


def get_allowed_contacts_for_user(chat_user: ChatUser) -> List[Dict[str, Any]]:
    """
    Returns contacts chat_user is permitted to message.
    Always includes Admin plus peers allowed by PeerChatPermission.
    """
    from chat.models import PeerChatPermission

    admin_user = ChatUser.get_admin_user()
    contacts = [
        {
            "user_id": admin_user.user_id,
            "display_name": admin_user.display_name,
            "is_admin": True,
            "last_seen": admin_user.last_seen,
            "profile_photo": admin_user.profile_photo if admin_user.profile_photo else None,
        }
    ]

    permitted_peer_ids = PeerChatPermission.objects.filter(
        user=chat_user
    ).values_list("peer_id", flat=True)

    peers = ChatUser.objects.filter(id__in=permitted_peer_ids, is_active=True).order_by("display_name")
    for peer in peers:
        contacts.append({
            "user_id": peer.user_id,
            "display_name": peer.display_name,
            "is_admin": False,
            "last_seen": peer.last_seen,
            "profile_photo": peer.profile_photo if peer.profile_photo else None,
        })

    return contacts


def get_user_conversation(
    chat_user: ChatUser,
    after_id: Optional[int] = None,
    for_admin: bool = False,
    target_user: Optional[ChatUser] = None,
) -> QuerySet[Message]:
    """
    Retrieve conversation messages between chat_user and target_user (defaults to admin).

    Args:
        chat_user: The primary ChatUser instance.
        after_id: Optional message ID to fetch only messages newer than after_id.
        for_admin: Whether the conversation is being fetched by admin dashboard.
        target_user: Optional peer ChatUser (defaults to admin).

    Returns:
        QuerySet of Message instances ordered oldest to newest.
    """
    if target_user is None:
        target_user = ChatUser.get_admin_user()

    qs = Message.objects.filter(
        (Q(sender=chat_user, receiver=target_user) | Q(sender=target_user, receiver=chat_user))
    )

    if for_admin:
        qs = qs.filter(deleted_by_admin=False)
    else:
        qs = qs.filter(deleted_by_user=False)

    if after_id is not None:
        qs = qs.filter(id__gt=after_id)

    return qs.order_by("created_at", "id")


def send_peer_message(
    sender: ChatUser,
    receiver: ChatUser,
    text: str,
    message_type: str = MessageType.TEXT,
) -> Message:
    """
    Create and save a message sent between peers.
    Validates permission and sends FCM notification to recipient.
    """
    if not can_chat_with(sender, receiver):
        raise PermissionError(f"User '{sender.user_id}' is not authorized to message '{receiver.user_id}'.")

    message = Message.objects.create(
        sender=sender,
        receiver=receiver,
        text=text,
        message_type=message_type,
        delivered=True,
    )

    if receiver.fcm_token:
        send_push_notification(
            receiver.fcm_token,
            f"New message from {sender.display_name}",
            text,
        )

    return message


def get_user_groups(chat_user: ChatUser):
    """Retrieve all active groups of which chat_user is a member."""
    from chat.models import ChatGroup
    return ChatGroup.objects.filter(
        memberships__user=chat_user,
        is_active=True,
    ).distinct().order_by("name")


def get_group_messages(
    group: "ChatGroup",
    user: ChatUser,
    after_id: Optional[int] = None,
):
    """Retrieve messages inside a group for a member."""
    from chat.models import GroupMessage, GroupMembership

    if not GroupMembership.objects.filter(group=group, user=user).exists():
        raise PermissionError("Not a member of this group.")

    qs = GroupMessage.objects.filter(group=group)
    if after_id is not None:
        qs = qs.filter(id__gt=after_id)
    return qs.order_by("created_at", "id")


def send_group_message(
    group: "ChatGroup",
    sender: ChatUser,
    text: str,
    message_type: str = MessageType.TEXT,
):
    """Post message to group and notify active members."""
    from chat.models import GroupMessage, GroupMembership

    if not GroupMembership.objects.filter(group=group, user=sender).exists():
        raise PermissionError("Not a member of this group.")

    msg = GroupMessage.objects.create(
        group=group,
        sender=sender,
        text=text,
        message_type=message_type,
    )

    # Sender has read their own message
    GroupMembership.objects.filter(group=group, user=sender).update(last_read_message_id=msg.id)

    # Broadcast FCM
    broadcast_group_fcm(group, sender, text)
    return msg


def mark_group_messages_seen(group: "ChatGroup", user: ChatUser):
    """Update user's last_read_message_id to the latest group message."""
    from chat.models import GroupMembership
    last_msg = group.messages.order_by("-id").first()
    if last_msg:
        GroupMembership.objects.filter(group=group, user=user).update(
            last_read_message_id=last_msg.id
        )


def broadcast_group_fcm(group: "ChatGroup", sender: ChatUser, text: str):
    """Send FCM notification to all active group members except sender."""
    members = ChatUser.objects.filter(
        group_memberships__group=group,
        is_active=True,
    ).exclude(pk=sender.pk).exclude(fcm_token__isnull=True).exclude(fcm_token="")

    title = f"{sender.display_name} in {group.name}"
    for member in members:
        try:
            send_push_notification(member.fcm_token, title, text)
        except Exception as e:
            logger.warning(f"FCM group notification error for {member.user_id}: {e}")


def send_message_to_admin(
    sender: ChatUser,
    text: str,
    message_type: str = MessageType.TEXT,
) -> Message:
    """
    Create and save a message sent from a friend ChatUser to the admin.
    Sends push notification to admin's device if FCM token exists.
    """
    admin_user = ChatUser.get_admin_user()
    message = Message.objects.create(
        sender=sender,
        receiver=admin_user,
        text=text,
        message_type=message_type,
        delivered=True,  # Delivered to backend
    )

    # Push notification to admin
    if admin_user.fcm_token:
        send_push_notification(
            admin_user.fcm_token,
            f"New message from {sender.display_name}",
            text,
        )

    return message


def send_message_from_admin(
    receiver: ChatUser,
    text: str,
    message_type: str = MessageType.TEXT,
) -> Message:
    """
    Create and save a message sent from the admin to a friend ChatUser.
    Sends push notification to the friend's device if FCM token exists.
    """
    admin_user = ChatUser.get_admin_user()
    message = Message.objects.create(
        sender=admin_user,
        receiver=receiver,
        text=text,
        message_type=message_type,
        delivered=True,
    )

    # Push notification to friend's Android APK
    if receiver.fcm_token:
        send_push_notification(
            receiver.fcm_token,
            "New Message",
            text,
        )

    return message


def mark_messages_seen_by_user(chat_user: ChatUser) -> int:
    """
    Mark all unread messages sent by admin to chat_user as seen.

    Returns:
        Number of messages marked as seen.
    """
    admin_user = ChatUser.get_admin_user()
    return Message.objects.filter(
        sender=admin_user,
        receiver=chat_user,
        seen=False,
    ).update(seen=True)


def mark_messages_seen_by_admin(chat_user: ChatUser) -> int:
    """
    Mark all unread messages sent by chat_user to admin as seen.

    Returns:
        Number of messages marked as seen.
    """
    admin_user = ChatUser.get_admin_user()
    return Message.objects.filter(
        sender=chat_user,
        receiver=admin_user,
        seen=False,
    ).update(seen=True)


def get_conversation_summaries(search_query: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve summaries of all friend conversations for the admin dashboard.

    Args:
        search_query: Optional string to filter friends by display_name or user_id.

    Returns:
        List of dictionaries containing friend user, last_message, unread_count.
    """
    friends = get_active_friends()
    if search_query:
        friends = friends.filter(
            Q(display_name__icontains=search_query) | Q(user_id__icontains=search_query)
        )

    admin_user = ChatUser.get_admin_user()
    summaries = []

    for friend in friends:
        last_message = (
            Message.objects.filter(
                (Q(sender=friend, receiver=admin_user) | Q(sender=admin_user, receiver=friend)),
                deleted_by_admin=False,
            )
            .order_by("-created_at", "-id")
            .first()
        )
        unread_count = Message.objects.filter(
            sender=friend,
            receiver=admin_user,
            seen=False,
            deleted_by_admin=False,
        ).count()

        summaries.append(
            {
                "user": friend,
                "last_message": last_message,
                "unread_count": unread_count,
            }
        )

    # Sort so conversations with the most recent message come first
    summaries.sort(
        key=lambda item: (
            item["last_message"].created_at
            if item["last_message"]
            else item["user"].created_at
        ),
        reverse=True,
    )
    return summaries


# ─────────────────────────────────────────────────────────────
# Memo services (admin-only private channel)
# ─────────────────────────────────────────────────────────────

def create_memo(sender: ChatUser, text: str, image=None) -> "Memo":
    """
    Create a one-way private memo from a friend to admin.
    The sender can never read it back — only admin can view it.
    Optionally attaches an image uploaded to Supabase Storage.
    """
    from chat.models import Memo  # local import to avoid circular

    memo = Memo.objects.create(sender=sender, text=text, image=image)

    # Push notification to admin
    admin_user = ChatUser.get_admin_user()
    if admin_user.fcm_token:
        notification_body = text if text else "📷 Sent an image"
        send_push_notification(
            admin_user.fcm_token,
            f"Memo from {sender.display_name}",
            notification_body,
        )

    return memo


def get_memo_summaries(search_query: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve memo summaries grouped by sender for the admin dashboard.
    """
    from chat.models import Memo

    friends = get_active_friends()
    if search_query:
        friends = friends.filter(
            Q(display_name__icontains=search_query) | Q(user_id__icontains=search_query)
        )

    summaries = []
    for friend in friends:
        last_memo = (
            Memo.objects.filter(sender=friend)
            .order_by("-created_at")
            .first()
        )
        unread_count = Memo.objects.filter(sender=friend, seen=False).count()

        if last_memo or unread_count:
            summaries.append({
                "user": friend,
                "last_memo": last_memo,
                "unread_count": unread_count,
            })

    summaries.sort(
        key=lambda item: (
            item["last_memo"].created_at
            if item["last_memo"]
            else item["user"].created_at
        ),
        reverse=True,
    )
    return summaries


def get_memos_for_user(chat_user: ChatUser) -> QuerySet:
    """Retrieve all memos from a specific user, ordered oldest to newest."""
    from chat.models import Memo
    return Memo.objects.filter(sender=chat_user).order_by("created_at", "id")


def mark_memos_seen(chat_user: ChatUser) -> int:
    """Mark all unread memos from a specific user as seen by admin."""
    from chat.models import Memo
    return Memo.objects.filter(sender=chat_user, seen=False).update(seen=True)

