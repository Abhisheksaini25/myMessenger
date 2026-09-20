"""End-to-end tests for the gallery app (run against a throwaway test DB)."""
from django.contrib.auth.models import User
from django.test import Client, TestCase
from django.urls import reverse

from .models import GalleryPerson, GallerySite
from .services import missing_asset_names


class GalleryPublicTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.person = GalleryPerson.objects.create(
            nick_name="Testy", dob="2003-08-12", number="98765", passcode="Testy-1208-98765"
        )
        cls.locked_site = GallerySite.objects.create(
            slug="cosmos", nick_name="Cosmos Wish", person=cls.person
        )

    def test_home_embeds_default_site(self):
        response = self.client.get(reverse("gallery_home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("gallery_site", args=["happynewyear"]))

    def test_locked_site_requires_passcode(self):
        response = self.client.get(reverse("gallery_site", args=["cosmos"]))
        self.assertEqual(response.status_code, 403)
        self.assertContains(response, "locked", status_code=403)

    def test_locked_asset_requires_passcode(self):
        response = self.client.get(reverse("gallery_site_asset", args=["cosmos", "script.js"]))
        self.assertEqual(response.status_code, 403)

    def test_unlock_with_wrong_then_right_code(self):
        response = self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "nope", "next": reverse("gallery_site", args=["cosmos"])},
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("error=1", response["Location"])

        response = self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "testy-1208-98765", "next": reverse("gallery_site", args=["cosmos"])},
            follow=True,
        )
        self.assertEqual(response.status_code, 200)

        # Passcode match is case-insensitive and persists in the session.
        self.assertIn(self.person.pk, self.client.session["gallery_unlocked_person_ids"])
        response = self.client.get(reverse("gallery_site", args=["cosmos"]))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Tap to begin")

    def test_unlocked_asset_served_locally(self):
        self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "Testy-1208-98765", "next": "/gallery/"},
        )
        response = self.client.get(reverse("gallery_site_asset", args=["cosmos", "med.mp3"]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "audio/mpeg")

    def test_admin_bypasses_lock(self):
        User.objects.create_superuser("temp-admin", "t@example.com", "pw12345!")
        client = Client()
        client.force_login(User.objects.get(username="temp-admin"))
        response = client.get(reverse("gallery_site", args=["cosmos"]))
        self.assertEqual(response.status_code, 200)

    def test_missing_assets_report_for_cosmos(self):
        self.assertEqual(
            missing_asset_names("cosmos"), ["final.png", "img.png", "photo.jpg"]
        )
        self.assertEqual(missing_asset_names("happynewyear"), [])

    def test_path_traversal_blocked(self):
        self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "Testy-1208-98765", "next": "/gallery/"},
        )
        response = self.client.get(
            reverse("gallery_site_asset", args=["cosmos", "../__init__.py"])
        )
        self.assertEqual(response.status_code, 404)


class BirthdayTests(TestCase):
    def test_birthday_serves_current_site(self):
        response = self.client.get("/birthday/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "js/main.js")

    def test_birthday_assets_served(self):
        response = self.client.get("/birthday/css/style.css")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/css")

        response = self.client.get("/birthday/assets/birthday_photo.jpg")
        self.assertEqual(response.status_code, 200)
        self.assertIn("jpeg", response["Content-Type"])

    def test_switching_current_site_switches_birthday(self):
        GallerySite.objects.create(slug="coctracker", nick_name="COC Tracker", is_current=True)
        response = self.client.get("/birthday/")
        self.assertContains(response, "bgm.mp3")


class GalleryEditTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = User.objects.create_superuser("temp-admin", "t@example.com", "pw12345!")

    def test_requires_admin(self):
        for url in [
            "/galleryedit/",
            "/galleryedit/persons/new/",
            "/galleryedit/sites/new/",
        ]:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 302)
            self.assertIn("/admin/login/", response["Location"])

    def test_person_crud_and_unique_passcode(self):
        client = Client()
        client.force_login(self.superuser)

        response = client.post(
            reverse("galleryedit_person_new"),
            {"nick_name": "Riya", "dob": "2003-08-12", "number": "9876543210", "passcode": "riya12084321"},
        )
        self.assertEqual(response.status_code, 302)
        person = GalleryPerson.objects.get(nick_name="Riya")
        self.assertEqual(person.passcode, "riya12084321")

        # Duplicate passcode is rejected.
        response = client.post(
            reverse("galleryedit_person_new"),
            {"nick_name": "Other", "passcode": "riya12084321"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "already exists")

    def test_site_registration_and_flag_switching(self):
        client = Client()
        client.force_login(self.superuser)
        person = GalleryPerson.objects.create(nick_name="Riya", passcode="riya12084321")

        response = client.post(
            reverse("galleryedit_site_new"),
            {
                "slug": "cosmos",
                "nick_name": "Cosmos Wish",
                "person": person.pk,
                "occasion_date": "2025-08-12",
                "is_default": False,
                "is_current": False,
            },
        )
        self.assertEqual(response.status_code, 302)
        site = GallerySite.objects.get(slug="cosmos")
        self.assertEqual(site.person, person)

        # Default requires a public site; edit to detach the person and flag it.
        client.post(reverse("galleryedit_site_edit", args=[site.pk]), {
            "nick_name": "Cosmos Wish",
            "person": "",
            "occasion_date": "2025-08-12",
            "is_default": True,
            "is_current": False,
        })
        site.refresh_from_db()
        self.assertTrue(site.is_default)
        self.assertFalse(
            GallerySite.objects.exclude(pk=site.pk).filter(is_default=True).exists()
        )

        client.post(reverse("galleryedit_site_set_current", args=[site.pk]))
        site.refresh_from_db()
        self.assertTrue(site.is_current)
        self.assertFalse(
            GallerySite.objects.exclude(pk=site.pk).filter(is_current=True).exists()
        )


class GalleryChatIntegrationTests(TestCase):
    """Test cases for API key configuration and web chat on /gallery/."""

    @classmethod
    def setUpTestData(cls):
        from users.models import ChatUser

        cls.chat_user = ChatUser.objects.create(
            user_id="friend_chat",
            display_name="Friend Chat",
            api_key="apk-key-friend-999",
            is_active=True,
        )
        cls.person_with_chat = GalleryPerson.objects.create(
            nick_name="Chatty",
            passcode="chatty-pass-123",
            api_key="apk-key-friend-999",
        )
        cls.person_without_chat = GalleryPerson.objects.create(
            nick_name="Silent",
            passcode="silent-pass-456",
            api_key="",
        )

    def test_get_chat_user_resolution(self):
        """Verify get_chat_user returns corresponding ChatUser if api_key matches."""
        self.assertEqual(self.person_with_chat.get_chat_user(), self.chat_user)
        self.assertIsNone(self.person_without_chat.get_chat_user())

        # If user becomes inactive, it shouldn't be resolved
        self.chat_user.is_active = False
        self.chat_user.save()
        self.assertIsNone(self.person_with_chat.get_chat_user())
        self.chat_user.is_active = True
        self.chat_user.save()

    def test_gallery_person_form_validation(self):
        """Verify GalleryPersonForm cleanly accepts valid keys and rejects invalid ones."""
        from gallery.forms import GalleryPersonForm

        # Valid key
        form = GalleryPersonForm(data={
            "nick_name": "Alice",
            "passcode": "alice-1234",
            "api_key": "apk-key-friend-999",
        })
        self.assertTrue(form.is_valid())

        # Empty key (optional)
        form_empty = GalleryPersonForm(data={
            "nick_name": "Bob",
            "passcode": "bob-1234",
            "api_key": "",
        })
        self.assertTrue(form_empty.is_valid())

        # Invalid nonexistent key
        form_invalid = GalleryPersonForm(data={
            "nick_name": "Charlie",
            "passcode": "charlie-1234",
            "api_key": "nonexistent-key-000",
        })
        self.assertFalse(form_invalid.is_valid())
        self.assertIn("api_key", form_invalid.errors)

    def test_gallery_home_chat_gating(self):
        """Verify chat UI elements only appear when an unlocked person has a valid API key."""
        # 1. Anonymous visitor — no chat
        res = self.client.get(reverse("gallery_home"))
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.context["chat_enabled"])
        self.assertNotContains(res, "id=\"chat-toggle\"")
        self.assertNotContains(res, "id=\"chat-panel\"")

        # 2. Unlock person WITHOUT chat
        self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "silent-pass-456", "next": reverse("gallery_home")},
        )
        res = self.client.get(reverse("gallery_home"))
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.context["chat_enabled"])
        self.assertNotContains(res, "id=\"chat-toggle\"")

        # 3. Unlock person WITH chat
        self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "chatty-pass-123", "next": reverse("gallery_home")},
        )
        res = self.client.get(reverse("gallery_home"))
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.context["chat_enabled"])
        self.assertEqual(res.context["chat_user"], self.chat_user)
        self.assertContains(res, "id=\"chat-toggle\"")
        self.assertContains(res, "id=\"chat-panel\"")
        self.assertContains(res, "friend_chat")


class GalleryShareLinkTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        from users.models import ChatUser
        cls.chat_user = ChatUser.objects.create(
            user_id="bday_friend",
            display_name="Birthday Friend",
            api_key="apk-key-bday-friend",
            is_active=True,
        )
        cls.person = GalleryPerson.objects.create(
            nick_name="Cosmic Person",
            passcode="cosmic-secret-code",
            api_key="apk-key-bday-friend",
        )
        cls.site = GallerySite.objects.create(
            slug="cosmos",
            nick_name="Cosmos Celebration",
            person=cls.person,
        )

    def test_direct_access_without_token_is_locked(self):
        """Visiting a locked person site directly without token returns 403."""
        response = self.client.get(reverse("gallery_site", args=["cosmos"]))
        self.assertEqual(response.status_code, 403)
        self.assertContains(response, "locked", status_code=403)

    def test_share_link_auto_unlocks_site(self):
        """Visiting /gallery/share/<slug>/<token>/ redirects to site and serves 200 OK."""
        token = self.site.get_share_token()
        share_url = reverse("gallery_share_link", kwargs={"slug": "cosmos", "token": token})

        response = self.client.get(share_url, follow=True)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Tap to begin")

        # Verify session has site slug stored in shared_site_slugs
        self.assertIn("cosmos", self.client.session.get("gallery_shared_site_slugs", []))

        # Subsequent asset request succeeds
        asset_resp = self.client.get(reverse("gallery_site_asset", args=["cosmos", "med.mp3"]))
        self.assertEqual(asset_resp.status_code, 200)

    def test_query_parameter_auto_unlock(self):
        """Visiting /gallery/site/<slug>/?share=<token> or ?code=<code> auto-unlocks."""
        # Using token
        token = self.site.get_share_token()
        resp_token = self.client.get(f"{reverse('gallery_site', args=['cosmos'])}?share={token}")
        self.assertEqual(resp_token.status_code, 200)

        # New client using passcode query parameter
        c = Client()
        resp_code = c.get(f"{reverse('gallery_site', args=['cosmos'])}?code=cosmic-secret-code")
        self.assertEqual(resp_code.status_code, 200)

    def test_invalid_share_token_returns_403(self):
        """Visiting with invalid token returns 403."""
        share_url = reverse("gallery_share_link", kwargs={"slug": "cosmos", "token": "invalidtoken1234"})
        response = self.client.get(share_url)
        self.assertEqual(response.status_code, 403)

    def test_share_link_visitor_does_not_get_chat_access(self):
        """CRITICAL: Accessing via share link must NOT enable chat on /gallery/."""
        token = self.site.get_share_token()
        share_url = reverse("gallery_share_link", kwargs={"slug": "cosmos", "token": token})

        # Visitor accesses via share link
        self.client.get(share_url, follow=True)

        # Visitor visits /gallery/ — chat must be disabled
        gal_resp = self.client.get(reverse("gallery_home"))
        self.assertEqual(gal_resp.status_code, 200)
        self.assertFalse(gal_resp.context["chat_enabled"])
        self.assertNotContains(gal_resp, "id=\"chat-toggle\"")
        self.assertNotContains(gal_resp, "id=\"chat-panel\"")

        # But if the person enters their passcode manually, chat IS enabled:
        self.client.post(
            reverse("gallery_unlock"),
            {"passcode": "cosmic-secret-code", "next": reverse("gallery_home")},
        )
        owner_resp = self.client.get(reverse("gallery_home"))
        self.assertTrue(owner_resp.context["chat_enabled"])
        self.assertContains(owner_resp, "id=\"chat-toggle\"")

