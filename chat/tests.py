"""
Tests for the chat app.

Verifies REST API endpoints (list, latest, send, seen), user isolation,
and HTMX Dashboard functionality.
"""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from chat.models import (
    Message,
    MessageType,
    ChatGroup,
    GroupMembership,
    GroupMessage,
    PeerChatPermission,
)
from chat.services import send_message_from_admin
from users.models import ChatUser


class ChatAppTests(APITestCase):
    """Test cases for Chat API and HTMX Dashboard views."""

    def setUp(self):
        """Set up test users and sample messages."""
        self.admin_user = ChatUser.get_admin_user()
        self.friend1 = ChatUser.objects.create(
            user_id="friend1",
            display_name="Alice Android",
            api_key="secret-key-alice",
            is_active=True,
        )
        self.friend2 = ChatUser.objects.create(
            user_id="friend2",
            display_name="Bob Builder",
            api_key="secret-key-bob",
            is_active=True,
        )

        # Admin sends a message to Alice
        self.msg1 = send_message_from_admin(self.friend1, "Hi Alice, welcome!")
        # Admin sends a message to Bob
        self.msg2 = send_message_from_admin(self.friend2, "Hi Bob!")

        # Create Django superuser for Dashboard tests
        django_user = get_user_model()
        self.superuser = django_user.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="adminpass123",
        )

    def test_message_list_isolation(self):
        """Verify friend1 only sees messages with admin, not friend2's messages."""
        url = reverse("api_messages_list")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["text"], "Hi Alice, welcome!")
        self.assertEqual(response.data[0]["sender"], "admin")
        self.assertEqual(response.data[0]["receiver"], "friend1")

    def test_send_message_from_android(self):
        """Verify POST /api/messages/send/ creates a message to admin."""
        url = reverse("api_messages_send")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")

        payload = {"text": "Hello Admin from Alice!", "message_type": "TEXT"}
        response = self.client.post(url, payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["sender"], "friend1")
        self.assertEqual(response.data["receiver"], "admin")
        self.assertEqual(response.data["text"], "Hello Admin from Alice!")

        # Confirm database count
        self.assertEqual(
            Message.objects.filter(sender=self.friend1, receiver=self.admin_user).count(),
            1,
        )

    def test_messages_latest_polling(self):
        """Verify GET /api/messages/latest/?after=ID returns only newer messages."""
        url = reverse("api_messages_latest")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")

        # After msg1.id, should be empty initially
        response = self.client.get(f"{url}?after={self.msg1.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        # Create a new message from admin
        new_msg = send_message_from_admin(self.friend1, "New message for Alice!")
        response_after = self.client.get(f"{url}?after={self.msg1.id}")
        self.assertEqual(response_after.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response_after.data), 1)
        self.assertEqual(response_after.data[0]["id"], new_msg.id)

    def test_mark_messages_seen(self):
        """Verify POST /api/messages/seen/ marks admin messages as seen."""
        url = reverse("api_messages_seen")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")

        self.assertFalse(Message.objects.get(id=self.msg1.id).seen)
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["marked_seen"], 1)
        self.assertTrue(Message.objects.get(id=self.msg1.id).seen)

    def test_dashboard_access_requires_superuser(self):
        """Verify unauthenticated access to /dashboard/ redirects to admin login."""
        url = reverse("dashboard_home")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/login/", response.url)

    def test_dashboard_access_for_superuser(self):
        """Verify superuser can load /dashboard/ and conversation partials."""
        self.client.force_login(self.superuser)
        url = reverse("dashboard_home")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check sidebar partial
        sidebar_url = reverse("dashboard_conversations")
        sidebar_resp = self.client.get(sidebar_url)
        self.assertEqual(sidebar_resp.status_code, status.HTTP_200_OK)
        self.assertIn(b"Alice Android", sidebar_resp.content)
        self.assertIn(b"Bob Builder", sidebar_resp.content)

    def test_dashboard_send_message_htmx(self):
        """Verify sending a message via dashboard HTMX POST appends the message."""
        self.client.force_login(self.superuser)
        send_url = reverse("dashboard_chat_send", kwargs={"user_id": "friend1"})
        response = self.client.post(send_url, {"text": "Reply from Admin Dashboard!"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b"Reply from Admin Dashboard!", response.content)
        self.assertEqual(
            Message.objects.filter(sender=self.admin_user, receiver=self.friend1).count(),
            2,
        )

    def test_friend_simulator_view(self):
        """Verify superuser can access the friend simulator view with enhanced modes."""
        self.client.force_login(self.superuser)
        url = reverse("dashboard_simulator")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b"Friend POV Simulator", response.content)
        self.assertIn(b"Full App (Inbox & All Chats)", response.content)
        self.assertIn(b"Direct Admin Chat (Classic)", response.content)
        self.assertIn(b"GLM Messenger", response.content)

        # Verify specific user simulator URL
        user_url = reverse("dashboard_simulator_user", kwargs={"user_id": "friend1"})
        user_resp = self.client.get(user_url)
        self.assertEqual(user_resp.status_code, status.HTTP_200_OK)
        self.assertIn(b"Alice Android", user_resp.content)

    def test_admin_panel_unauthenticated_redirects(self):
        """Verify unauthenticated user cannot access /panel/."""
        url = reverse("admin_panel")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/admin/login/", response["Location"])

    def test_admin_panel_authenticated_superuser(self):
        """Verify superuser can access /panel/ and sees cards and stats."""
        self.client.force_login(self.superuser)
        url = reverse("admin_panel")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertContains(response, "Admin Control Hub")
        self.assertContains(response, reverse("dashboard_home"))
        self.assertContains(response, reverse("dashboard_simulator"))
        self.assertContains(response, reverse("memo_dashboard"))
        self.assertContains(response, reverse("galleryedit_home"))
        self.assertContains(response, reverse("admin:index"))
        self.assertContains(response, reverse("admin_groups"))
        self.assertContains(response, reverse("admin_peer_permissions"))

    def test_contact_list_discovery_and_permissions(self):
        """Verify /api/contacts/ returns Admin, and only peers with explicit permission."""
        url = reverse("api_contacts_list")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")

        # Initially friend1 only has permission to chat with admin
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        contact_ids = [c["user_id"] for c in resp.data]
        self.assertIn("admin", contact_ids)
        self.assertNotIn("friend2", contact_ids)

        # Admin grants permission from friend1 to friend2
        PeerChatPermission.objects.create(user=self.friend1, peer=self.friend2)

        resp2 = self.client.get(url)
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        contact_ids2 = [c["user_id"] for c in resp2.data]
        self.assertIn("admin", contact_ids2)
        self.assertIn("friend2", contact_ids2)

        # Bob (friend2) does not have reverse permission yet
        self.client.credentials(HTTP_X_USER_ID="friend2", HTTP_X_API_KEY="secret-key-bob")
        bob_resp = self.client.get(url)
        bob_contact_ids = [c["user_id"] for c in bob_resp.data]
        self.assertIn("admin", bob_contact_ids)
        self.assertNotIn("friend1", bob_contact_ids)

    def test_peer_to_peer_messaging_permission_enforcement(self):
        """Verify peer messaging fails (403) without permission and succeeds with permission."""
        send_url = reverse("api_messages_send")

        # Alice attempts to message Bob without permission
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")
        resp_blocked = self.client.post(send_url, {"receiver": "friend2", "text": "Hey Bob!"})
        self.assertEqual(resp_blocked.status_code, status.HTTP_403_FORBIDDEN)

        # Admin grants permission from Alice to Bob
        PeerChatPermission.objects.create(user=self.friend1, peer=self.friend2)

        # Alice messages Bob again -> Success (201 Created)
        resp_allowed = self.client.post(send_url, {"receiver": "friend2", "text": "Hey Bob!"})
        self.assertEqual(resp_allowed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp_allowed.data["sender"], "friend1")
        self.assertEqual(resp_allowed.data["receiver"], "friend2")

        # Alice fetches conversation with Bob
        list_url = reverse("api_messages_list")
        list_resp = self.client.get(f"{list_url}?user=friend2")
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_resp.data), 1)
        self.assertEqual(list_resp.data[0]["text"], "Hey Bob!")

        # Bob marks seen for Alice's messages
        self.client.credentials(HTTP_X_USER_ID="friend2", HTTP_X_API_KEY="secret-key-bob")
        seen_url = reverse("api_messages_seen")
        seen_resp = self.client.post(seen_url, {"user": "friend1"})
        self.assertEqual(seen_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(seen_resp.data["marked_seen"], 1)

    def test_group_chat_lifecycle(self):
        """Verify group creation, membership discovery, send/receive, and seen state."""
        # Create group with Alice as member
        group = ChatGroup.objects.create(name="Team Alpha", slug="team-alpha", description="Secret team")
        GroupMembership.objects.create(group=group, user=self.friend1)

        groups_url = reverse("api_groups_list")
        msg_send_url = reverse("api_group_send", kwargs={"slug": "team-alpha"})
        msg_list_url = reverse("api_group_messages", kwargs={"slug": "team-alpha"})
        msg_seen_url = reverse("api_group_seen", kwargs={"slug": "team-alpha"})

        # Alice lists groups -> sees team-alpha
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")
        resp_alice = self.client.get(groups_url)
        self.assertEqual(resp_alice.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_alice.data), 1)
        self.assertEqual(resp_alice.data[0]["slug"], "team-alpha")

        # Bob (not member) lists groups -> sees nothing
        self.client.credentials(HTTP_X_USER_ID="friend2", HTTP_X_API_KEY="secret-key-bob")
        resp_bob = self.client.get(groups_url)
        self.assertEqual(resp_bob.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_bob.data), 0)

        # Bob attempts to send message to group -> 403 Forbidden
        bob_send = self.client.post(msg_send_url, {"text": "I am intruding"})
        self.assertEqual(bob_send.status_code, status.HTTP_403_FORBIDDEN)

        # Alice sends message to group -> 201 Created
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")
        alice_send = self.client.post(msg_send_url, {"text": "Welcome to Team Alpha!"})
        self.assertEqual(alice_send.status_code, status.HTTP_201_CREATED)
        self.assertEqual(alice_send.data["text"], "Welcome to Team Alpha!")
        msg_id = alice_send.data["id"]

        # Alice reads group messages -> 200 OK
        alice_list = self.client.get(msg_list_url)
        self.assertEqual(alice_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(alice_list.data), 1)

        # Alice marks seen
        alice_seen = self.client.post(msg_seen_url, {})
        self.assertEqual(alice_seen.status_code, status.HTTP_200_OK)
        membership = GroupMembership.objects.get(group=group, user=self.friend1)
        self.assertEqual(membership.last_read_message_id, msg_id)

    def test_admin_permissions_and_groups_panels(self):
        """Verify superuser can manage permissions and groups via admin panels."""
        self.client.force_login(self.superuser)

        # 1. Load permissions view
        perm_url = reverse("admin_peer_permissions")
        resp_perm = self.client.get(perm_url)
        self.assertEqual(resp_perm.status_code, status.HTTP_200_OK)

        # Save permission
        save_resp = self.client.post(
            perm_url,
            {
                "action": "save_permissions",
                "user_id": "friend1",
                "allowed_peers": ["friend2"],
                "bidirectional": "1",
            },
        )
        self.assertEqual(save_resp.status_code, status.HTTP_302_FOUND)
        self.assertTrue(PeerChatPermission.objects.filter(user=self.friend1, peer=self.friend2).exists())
        self.assertTrue(PeerChatPermission.objects.filter(user=self.friend2, peer=self.friend1).exists())

        # 2. Load groups panel
        groups_url = reverse("admin_groups")
        resp_groups = self.client.get(groups_url)
        self.assertEqual(resp_groups.status_code, status.HTTP_200_OK)

        # Create group via panel
        create_url = reverse("admin_group_create")
        create_resp = self.client.post(
            create_url,
            {
                "name": "Beta Testers",
                "slug": "beta-testers",
                "description": "App testing group",
                "members": ["friend1", "friend2"],
            },
        )
        self.assertEqual(create_resp.status_code, status.HTTP_302_FOUND)
        self.assertTrue(ChatGroup.objects.filter(slug="beta-testers").exists())
        group = ChatGroup.objects.get(slug="beta-testers")
        self.assertEqual(group.memberships.count(), 2)

        # Edit group via panel
        edit_url = reverse("admin_group_edit", kwargs={"slug": "beta-testers"})
        edit_resp = self.client.post(
            edit_url,
            {
                "name": "Beta Testers Renamed",
                "description": "Updated description",
                "is_active": "1",
                "members": ["friend1"],
            },
        )
        self.assertEqual(edit_resp.status_code, status.HTTP_302_FOUND)
        group.refresh_from_db()
        self.assertEqual(group.name, "Beta Testers Renamed")
        self.assertEqual(group.memberships.count(), 1)

        # Delete group via panel
        del_url = reverse("admin_group_delete", kwargs={"slug": "beta-testers"})
        del_resp = self.client.post(del_url, {})
        self.assertEqual(del_resp.status_code, status.HTTP_302_FOUND)
        self.assertFalse(ChatGroup.objects.filter(slug="beta-testers").exists())


