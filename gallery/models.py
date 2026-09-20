"""Models for the birthday-wish gallery archive."""
from django.db import models


class GalleryPerson(models.Model):
    """A person for whom one or more gallery sites were made.

    ``passcode`` is the single secret that unlocks this person's sites on the
    public /gallery page — set manually by the admin in /galleryedit.
    """

    nick_name = models.CharField(max_length=100)
    dob = models.DateField(null=True, blank=True)
    number = models.CharField(max_length=32, blank=True)
    passcode = models.CharField(max_length=64, unique=True)
    api_key = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Optional ChatUser API key (e.g. apk-key-abc-123) enabling chat for this person.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nick_name"]

    def __str__(self):
        return self.nick_name

    def get_chat_user(self):
        """Return the matching active ChatUser instance if api_key is configured, else None."""
        if not self.api_key:
            return None
        from users.models import ChatUser
        return ChatUser.objects.filter(api_key=self.api_key.strip(), is_active=True).first()


class GallerySite(models.Model):
    """A standalone wish site (a folder under backend/sites/) registered in the gallery.

    ``person`` is null for public sites, which are visible to everyone.
    ``is_default`` marks the site shown to everyone on /gallery.
    ``is_current`` marks the site served on /birthday (always publicly reachable).
    """

    slug = models.SlugField(unique=True)
    nick_name = models.CharField(max_length=120)
    person = models.ForeignKey(
        GalleryPerson,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sites",
    )
    occasion_date = models.DateField(null=True, blank=True)
    is_default = models.BooleanField(default=False)
    is_current = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "-occasion_date", "-created_at"]

    def __str__(self):
        return f"{self.nick_name} ({self.slug})"

    def save(self, *args, **kwargs):
        # Only one default and one current site at a time.
        if self.is_default:
            GallerySite.objects.exclude(pk=self.pk).update(is_default=False)
        if self.is_current:
            GallerySite.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def get_share_token(self) -> str:
        from .services import generate_site_share_token
        return generate_site_share_token(self)

    def get_share_url(self) -> str:
        from django.urls import reverse
        return reverse("gallery_share_link", kwargs={"slug": self.slug, "token": self.get_share_token()})


class GalleryMemory(models.Model):
    """An image memory uploaded to a site, stored in Supabase under gallery/<slug>/memories/."""

    site = models.ForeignKey(
        GallerySite,
        on_delete=models.CASCADE,
        related_name="memories",
    )
    name = models.CharField(max_length=255)
    file_name = models.CharField(max_length=255)
    image_url = models.URLField(max_length=1000, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.name} ({self.site.slug})"


