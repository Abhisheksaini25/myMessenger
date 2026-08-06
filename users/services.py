"""
Service functions for user operations.

Encapsulates business logic for user updates and queries.
"""
from django.db.models import QuerySet
from django.utils import timezone
from users.models import ChatUser


def update_last_seen(chat_user: ChatUser) -> None:
    """
    Update the last_seen timestamp of a ChatUser to current time.
    """
    chat_user.last_seen = timezone.now()
    chat_user.save(update_fields=["last_seen", "updated_at"])


def get_active_friends() -> QuerySet[ChatUser]:
    """
    Retrieve all active friend ChatUsers, excluding the admin counterpart.
    """
    return ChatUser.objects.filter(is_active=True).exclude(user_id="admin")
