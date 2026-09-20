"""
HTMX Dashboard views for the chat app.

Provides a WhatsApp Web-style interface for the admin to converse with
Android APK friends. Supports HTMX polling every 3 seconds, search,
and snappy message sending without full page refreshes.
"""
import json
from typing import Optional
from django.contrib.auth.decorators import user_passes_test
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from chat.models import MessageType
from chat.services import (
    create_memo,
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
def admin_panel_view(request: HttpRequest) -> HttpResponse:
    """
    GET /panel/

    Centralized Control Hub for all admin interfaces:
    - Chat Dashboard (/dashboard/)
    - Friend Simulator (/dashboard/simulator/)
    - Internal Memos (/dashboard/internal/)
    - Gallery Management (/galleryedit/)
    - Django Admin (/admin/)
    - Public Portals (/gallery/, /birthday/)
    """
    from chat.models import Message, Memo, ChatGroup, PeerChatPermission
    from gallery.models import GalleryPerson, GallerySite

    active_friends_count = ChatUser.objects.filter(is_active=True).exclude(user_id="admin").count()
    unread_messages_count = Message.objects.filter(
        receiver__user_id="admin",
        seen=False,
        deleted_by_admin=False,
    ).count()
    unread_memos_count = Memo.objects.filter(seen=False).count()
    sites_count = GallerySite.objects.count()
    persons_count = GalleryPerson.objects.count()
    groups_count = ChatGroup.objects.count()
    permissions_count = PeerChatPermission.objects.count()
    current_site = GallerySite.objects.filter(is_current=True).first()
    default_site = GallerySite.objects.filter(is_default=True).first()

    context = {
        "active_friends_count": active_friends_count,
        "unread_messages_count": unread_messages_count,
        "unread_memos_count": unread_memos_count,
        "sites_count": sites_count,
        "persons_count": persons_count,
        "groups_count": groups_count,
        "permissions_count": permissions_count,
        "current_site": current_site,
        "default_site": default_site,
        "admin_username": request.user.username,
    }
    return render(request, "panel/index.html", context)


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


# ─────────────────────────────────────────────────────────────
# Birthday Page Event Tracking
# ─────────────────────────────────────────────────────────────

# The user_id whose memos will appear in the admin dashboard
BIRTHDAY_TRACKER_USER_ID = "ananya"


@method_decorator(csrf_exempt, name="dispatch")
class BirthdayTrackView(View):
    """
    POST /birthday/track/

    Receives birthday page events from the frontend JS and saves them
    as Memo objects under the 'ananya' user. No authentication required —
    credentials stay server-side.

    Accepts two content types:
    - application/json: {"text": "..."} for text-only events
    - multipart/form-data: text + image file for gallery uploads
    """

    def post(self, request, *args, **kwargs):
        content_type = request.content_type or ""

        # Parse text and image depending on content type
        if "multipart" in content_type:
            text = request.POST.get("text", "").strip()
            image = request.FILES.get("image")
        else:
            try:
                body = json.loads(request.body)
            except (json.JSONDecodeError, ValueError):
                return JsonResponse(
                    {"status": "error", "detail": "Invalid JSON."},
                    status=400,
                )
            text = body.get("text", "").strip()
            image = None

        if not text and not image:
            return JsonResponse(
                {"status": "error", "detail": "Text or image is required."},
                status=400,
            )

        try:
            sender = ChatUser.objects.get(user_id=BIRTHDAY_TRACKER_USER_ID)
        except ChatUser.DoesNotExist:
            return JsonResponse(
                {"status": "error", "detail": "Tracker user not found."},
                status=404,
            )

        memo = create_memo(sender=sender, text=text, image=image)
        return JsonResponse(
            {"status": "ok", "id": memo.id},
            status=201,
        )


# ─────────────────────────────────────────────────────────────
# Peer Chat Permissions Panel (/panel/permissions/)
# ─────────────────────────────────────────────────────────────

@admin_required
def admin_peer_permissions_view(request: HttpRequest) -> HttpResponse:
    """
    GET/POST /panel/permissions/
    Matrix and pairing manager controlling which friends are allowed to message each other.
    """
    from django.contrib import messages
    from chat.models import PeerChatPermission

    friends = ChatUser.objects.filter(is_active=True).exclude(user_id="admin").order_by("display_name")
    selected_user_id = request.GET.get("user")
    selected_user = None

    if selected_user_id:
        selected_user = friends.filter(user_id=selected_user_id).first()
    if not selected_user and friends.exists():
        selected_user = friends.first()

    if request.method == "POST":
        action = request.POST.get("action", "")

        if action == "save_permissions":
            form_user_id = request.POST.get("user_id")
            form_user = get_object_or_404(ChatUser, user_id=form_user_id, is_active=True)
            allowed_peer_ids = request.POST.getlist("allowed_peers")
            is_bidirectional = request.POST.get("bidirectional") == "1"

            # Remove existing outgoing permissions for this user
            PeerChatPermission.objects.filter(user=form_user).delete()

            # Create new permissions
            for peer_id in allowed_peer_ids:
                peer = ChatUser.objects.filter(user_id=peer_id, is_active=True).first()
                if peer and peer.pk != form_user.pk:
                    PeerChatPermission.objects.get_or_create(user=form_user, peer=peer)
                    if is_bidirectional:
                        PeerChatPermission.objects.get_or_create(user=peer, peer=form_user)

            messages.success(request, f"Permissions updated for {form_user.display_name}.")
            return redirect(f"{reverse('admin_peer_permissions')}?user={form_user.user_id}")

        elif action == "revoke_link":
            link_id = request.POST.get("link_id")
            PeerChatPermission.objects.filter(id=link_id).delete()
            messages.success(request, "Permission link revoked.")
            return redirect("admin_peer_permissions")

    current_allowed_peer_ids = []
    if selected_user:
        current_allowed_peer_ids = list(
            PeerChatPermission.objects.filter(user=selected_user).values_list("peer__user_id", flat=True)
        )

    all_links = PeerChatPermission.objects.select_related("user", "peer").order_by("-created_at")

    context = {
        "friends": friends,
        "selected_user": selected_user,
        "current_allowed_peer_ids": current_allowed_peer_ids,
        "all_links": all_links,
    }
    return render(request, "panel/permissions.html", context)


# ─────────────────────────────────────────────────────────────
# Group Management Panels (/panel/groups/)
# ─────────────────────────────────────────────────────────────

@admin_required
def admin_groups_view(request: HttpRequest) -> HttpResponse:
    """GET /panel/groups/ — lists all groups with members and metrics."""
    from chat.models import ChatGroup

    groups = ChatGroup.objects.all().prefetch_related("memberships__user", "messages").order_by("-created_at")
    context = {"groups": groups}
    return render(request, "panel/groups_list.html", context)


@admin_required
def admin_group_create_view(request: HttpRequest) -> HttpResponse:
    """GET/POST /panel/groups/new/ — create group and assign members by API key."""
    from django.contrib import messages
    from django.utils.text import slugify
    from chat.models import ChatGroup, GroupMembership

    friends = ChatUser.objects.filter(is_active=True).exclude(user_id="admin").order_by("display_name")

    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        slug = request.POST.get("slug", "").strip() or slugify(name)
        description = request.POST.get("description", "").strip()
        member_ids = request.POST.getlist("members")

        if not name or not slug:
            messages.error(request, "Group name and slug are required.")
        elif ChatGroup.objects.filter(slug=slug).exists():
            messages.error(request, f"A group with slug '{slug}' already exists.")
        else:
            group = ChatGroup.objects.create(
                name=name,
                slug=slug,
                description=description,
                is_active=True,
            )
            for uid in member_ids:
                user = ChatUser.objects.filter(user_id=uid, is_active=True).first()
                if user:
                    GroupMembership.objects.create(group=group, user=user)

            messages.success(request, f"Group '{group.name}' created with {group.member_count} members.")
            return redirect("admin_groups")

    return render(request, "panel/group_form.html", {"friends": friends, "is_new": True})


@admin_required
def admin_group_edit_view(request: HttpRequest, slug: str) -> HttpResponse:
    """GET/POST /panel/groups/<slug>/edit/ — edit group properties and members."""
    from django.contrib import messages
    from chat.models import ChatGroup, GroupMembership

    group = get_object_or_404(ChatGroup, slug=slug)
    friends = ChatUser.objects.filter(is_active=True).exclude(user_id="admin").order_by("display_name")

    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        description = request.POST.get("description", "").strip()
        is_active = request.POST.get("is_active") == "1"
        member_ids = request.POST.getlist("members")

        if not name:
            messages.error(request, "Group name cannot be empty.")
        else:
            group.name = name
            group.description = description
            group.is_active = is_active
            group.save()

            GroupMembership.objects.filter(group=group).delete()
            for uid in member_ids:
                user = ChatUser.objects.filter(user_id=uid, is_active=True).first()
                if user:
                    GroupMembership.objects.create(group=group, user=user)

            messages.success(request, f"Group '{group.name}' updated.")
            return redirect("admin_groups")

    current_member_ids = list(group.memberships.values_list("user__user_id", flat=True))
    context = {
        "group": group,
        "friends": friends,
        "current_member_ids": current_member_ids,
        "is_new": False,
    }
    return render(request, "panel/group_form.html", context)


@admin_required
def admin_group_delete_view(request: HttpRequest, slug: str) -> HttpResponse:
    """POST /panel/groups/<slug>/delete/ — delete a group."""
    from django.contrib import messages
    from chat.models import ChatGroup

    if request.method == "POST":
        group = get_object_or_404(ChatGroup, slug=slug)
        group_name = group.name
        group.delete()
        messages.success(request, f"Group '{group_name}' deleted.")
    return redirect("admin_groups")
