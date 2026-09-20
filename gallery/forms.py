"""Forms for the /galleryedit admin pages."""
from django import forms

from .models import GalleryPerson, GallerySite
from .services import folder_has_site, unregistered_site_folders


class GalleryPersonForm(forms.ModelForm):
    class Meta:
        model = GalleryPerson
        fields = ["nick_name", "dob", "number", "passcode", "api_key"]
        widgets = {
            "dob": forms.DateInput(attrs={"type": "date"}),
            "api_key": forms.TextInput(attrs={"placeholder": "e.g. apk-key-abc-123", "list": "chat-user-keys"}),
        }

    def clean_api_key(self):
        api_key = self.cleaned_data.get("api_key", "").strip()
        if api_key:
            from users.models import ChatUser
            if not ChatUser.objects.filter(api_key=api_key).exists():
                raise forms.ValidationError(
                    f"No ChatUser found with API key '{api_key}'. Ensure this API key matches an existing ChatUser."
                )
        return api_key


class GallerySiteForm(forms.ModelForm):
    class Meta:
        model = GallerySite
        fields = ["nick_name", "person", "occasion_date", "is_default", "is_current"]
        widgets = {
            "occasion_date": forms.DateInput(attrs={"type": "date"}),
        }

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("is_default") and cleaned.get("person"):
            raise forms.ValidationError(
                "The default site shown to everyone on /gallery must be public (no person)."
            )
        return cleaned


class GallerySiteNewForm(GallerySiteForm):
    slug = forms.ChoiceField(label="Site folder", help_text="Only folders with an index.html can be registered.")

    class Meta(GallerySiteForm.Meta):
        fields = ["slug"] + GallerySiteForm.Meta.fields

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        folders = unregistered_site_folders()
        self.fields["slug"].choices = [("", "— choose a folder —")] + [(f, f) for f in folders]
        self.fields["slug"].widget.attrs["disabled_folders"] = [
            f for f in folders if not folder_has_site(f)
        ]

    def clean_slug(self):
        slug = self.cleaned_data["slug"]
        if not folder_has_site(slug):
            raise forms.ValidationError("That folder has no index.html — it cannot be registered.")
        return slug
