"""
Tests for the chat app.

Verifies REST API endpoints (list, latest, send, seen), user isolation,
and HTMX Dashboard functionality.
"""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from chat.models import Message, MessageType
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
        """Verify superuser can access the friend simulator view."""
        self.client.force_login(self.superuser)
        url = reverse("dashboard_simulator")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(b"Friend POV Simulator", response.content)

