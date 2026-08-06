"""
Tests for the users app.

Verifies model behavior, custom DRF AndroidHeadersAuthentication,
and the /api/ping/ endpoint.
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from users.models import ChatUser


class UsersAppTests(APITestCase):
    """Test cases for ChatUser model, authentication, and ping view."""

    def setUp(self):
        """Set up test users."""
        self.admin_user = ChatUser.get_admin_user()
        self.friend = ChatUser.objects.create(
            user_id="friend1",
            display_name="Alice Android",
            api_key="secret-key-alice",
            is_active=True,
        )

    def test_get_admin_user(self):
        """Verify that get_admin_user initializes the admin counterpart user."""
        self.assertEqual(self.admin_user.user_id, "admin")
        self.assertTrue(self.admin_user.is_active)

    def test_ping_without_headers_returns_401(self):
        """Verify that missing X-USER-ID or X-API-KEY returns HTTP 401."""
        url = reverse("api_ping")
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ping_with_invalid_headers_returns_401(self):
        """Verify that incorrect credentials return HTTP 401."""
        url = reverse("api_ping")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="wrong-key")
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ping_with_admin_header_returns_401(self):
        """Verify that external APKs cannot authenticate as 'admin'."""
        url = reverse("api_ping")
        self.client.credentials(
            HTTP_X_USER_ID="admin",
            HTTP_X_API_KEY=self.admin_user.api_key,
        )
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_ping_success(self):
        """Verify successful ping updates last_seen and returns status ok."""
        url = reverse("api_ping")
        self.client.credentials(HTTP_X_USER_ID="friend1", HTTP_X_API_KEY="secret-key-alice")
        response = self.client.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertIn("server_time", response.data)

        self.friend.refresh_from_db()
        self.assertIsNotNone(self.friend.last_seen)
