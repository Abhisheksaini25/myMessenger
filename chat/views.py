"""
HTMX Dashboard views for the chat app.

Provides a WhatsApp Web-style interface for the admin to converse with
Android APK friends. Supports HTMX polling every 3 seconds, search,
and snappy message sending without full page refreshes.
"""
from typing import Optional
from django.contrib.auth.decorators import user_passes_test
from django.http import HttpRequest, HttpResponse, Http404
from django.shortcuts import get_object_or_404, render
from chat.models import MessageType
from chat.services import (
    get_conversation_summaries,
    get_user_conversation,
    mark_messages_seen_by_admin,
    send_message_from_admin,
)
from users.models import ChatUser
from users.services import get_active_friends


def admin_required(function=None):
    """Decorator to require Django superuser or staff status."""
    actual_decorator = user_passes_test(
        lambda u: u.is_authenticated and (u.is_superuser or u.is_staff),
        login_url="/admin/login/",
    )
    if function:
        return actual_decorator(function)
    return actual_decorator


@admin_required
def dashboard_view(request: HttpRequest) -> HttpResponse:
    """
    GET /dashboard/

    Render the main WhatsApp Web-like interface.
    """
    search_query = request.GET.get("q", "").strip()
    summaries = get_conversation_summaries(search_query=search_query)

    context = {
        "summaries": summaries,
        "search_query": search_query,
    }
    return render(request, "dashboard/index.html", context)


@admin_required
def conversation_list_view(request: HttpRequest) -> HttpResponse:
    """
    GET /dashboard/conversations/

    Return HTMX partial for the sidebar conversation list.
    Supports search filtering and 3s auto-refresh polling.
    """
    search_query = request.GET.get("q", "").strip()
    summaries = get_conversation_summaries(search_query=search_query)

    context = {
        "summaries": summaries,
        "search_query": search_query,
    }
    return render(request, "dashboard/partials/sidebar_list.html", context)


@admin_required
def chat_window_view(request: HttpRequest, user_id: str) -> HttpResponse:
    """
    GET /dashboard/chat/<user_id>/

    Return HTMX partial for the main chat window for the selected friend.
    Marks any unread messages from this friend as seen.
    """
    friend = get_object_or_404(ChatUser, user_id=user_id, is_active=True)
    mark_messages_seen_by_admin(friend)

    messages = get_user_conversation(friend, for_admin=True)

    context = {
        "active_user": friend,
        "messages": messages,
    }
    return render(request, "dashboard/partials/chat_window.html", context)


@admin_required
def chat_messages_view(request: HttpRequest, user_id: str) -> HttpResponse:
    """
    GET /dashboard/chat/<user_id>/messages/

    Return HTMX partial for the message list inside the chat window.
    Polled every 3 seconds by the dashboard.
    """
    friend = get_object_or_404(ChatUser, user_id=user_id, is_active=True)
    mark_messages_seen_by_admin(friend)

    messages = get_user_conversation(friend, for_admin=True)

    context = {
        "active_user": friend,
        "messages": messages,
    }
    return render(request, "dashboard/partials/message_list.html", context)


@admin_required
def send_message_view(request: HttpRequest, user_id: str) -> HttpResponse:
    """
    POST /dashboard/chat/<user_id>/send/

    Handle message send from the dashboard input form via HTMX.
    Creates message and returns the updated message list partial.
    """
    friend = get_object_or_404(ChatUser, user_id=user_id, is_active=True)
    text = request.POST.get("text", "").strip()

    if text:
        send_message_from_admin(
            receiver=friend,
            text=text,
            message_type=MessageType.TEXT,
        )

    mark_messages_seen_by_admin(friend)
    messages = get_user_conversation(friend, for_admin=True)

    context = {
        "active_user": friend,
        "messages": messages,
    }
    return render(request, "dashboard/partials/message_list.html", context)


@admin_required
def friend_simulator_view(request: HttpRequest, user_id: Optional[str] = None) -> HttpResponse:
    """
    GET /dashboard/simulator/ or /dashboard/simulator/<user_id>/

    Render the Friend POV Smartphone Simulator.
    Allows testing messaging from any friend's perspective using real API headers.
    """
    friends = list(get_active_friends())
    if not friends:
        raise Http404("No active friends found.")

    active_friend = None
    if user_id:
        active_friend = ChatUser.objects.filter(user_id=user_id, is_active=True).first()
    if not active_friend:
        active_friend = friends[0]

    context = {
        "friends": friends,
        "active_friend": active_friend,
    }
    return render(request, "dashboard/simulator.html", context)


# ─────────────────────────────────────────────────────────────
# Memo Dashboard Views (admin-only private channel)
# ─────────────────────────────────────────────────────────────

@admin_required
def memo_dashboard_view(request: HttpRequest) -> HttpResponse:
    """
    GET /dashboard/internal/

    Render the memo dashboard — admin-only inbox for private one-way notes.
    """
    from chat.services import get_memo_summaries

    search_query = request.GET.get("q", "").strip()
    summaries = get_memo_summaries(search_query=search_query)

    context = {
        "summaries": summaries,
        "search_query": search_query,
    }
    return render(request, "dashboard/memo_index.html", context)


@admin_required
def memo_sidebar_view(request: HttpRequest) -> HttpResponse:
    """
    GET /dashboard/internal/senders/

    HTMX partial for memo sender sidebar list with 3s auto-refresh.
    """
    from chat.services import get_memo_summaries

    search_query = request.GET.get("q", "").strip()
    summaries = get_memo_summaries(search_query=search_query)

    context = {
        "summaries": summaries,
        "search_query": search_query,
    }
    return render(request, "dashboard/partials/memo_sidebar_list.html", context)


@admin_required
def memo_thread_view(request: HttpRequest, user_id: str) -> HttpResponse:
    """
    GET /dashboard/internal/thread/<user_id>/

    HTMX partial for the full memo thread from a specific sender.
    Marks all memos from this sender as seen.
    """
    from chat.services import get_memos_for_user, mark_memos_seen

    friend = get_object_or_404(ChatUser, user_id=user_id, is_active=True)
    mark_memos_seen(friend)
    memos = get_memos_for_user(friend)

    context = {
        "active_user": friend,
        "memos": memos,
    }
    return render(request, "dashboard/partials/memo_thread.html", context)


@admin_required
def memo_messages_view(request: HttpRequest, user_id: str) -> HttpResponse:
    """
    GET /dashboard/internal/thread/<user_id>/feed/

    HTMX partial for memo message list — polled every 3s.
    """
    from chat.services import get_memos_for_user, mark_memos_seen

    friend = get_object_or_404(ChatUser, user_id=user_id, is_active=True)
    mark_memos_seen(friend)
    memos = get_memos_for_user(friend)

    context = {
        "active_user": friend,
        "memos": memos,
    }
    return render(request, "dashboard/partials/memo_messages.html", context)


