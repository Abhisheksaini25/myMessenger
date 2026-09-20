"""Admin-only gallery management views (/galleryedit/)."""
import os

from django.contrib import messages
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from chat.views import admin_required

from .forms import GalleryPersonForm, GallerySiteForm, GallerySiteNewForm
from .models import GalleryPerson, GallerySite
from .services import (
    local_asset_names,
    missing_asset_names,
    unregistered_site_folders,
)
from .storage import gallery_asset_storage, supabase_configured


def _walk_storage_files(storage) -> list:
    """Recursively list files in a storage root as relative names."""
    files = []
    pending = [""]
    while pending:
        current = pending.pop()
        try:
            dirs, names = storage.listdir(current)
        except Exception:
            break
        files.extend(names)
        for directory in dirs:
            pending.append(f"{current}/{directory}".lstrip("/"))
    return sorted(files)


# ─────────────────────────────────────────────────────────────
# People
# ─────────────────────────────────────────────────────────────

@admin_required
def galleryedit_home(request):
    context = {
        "persons": GalleryPerson.objects.prefetch_related("sites"),
        "sites": GallerySite.objects.select_related("person"),
        "unregistered_folders": unregistered_site_folders(),
        "storage_remote": supabase_configured(),
    }
    return render(request, "gallery/edit/overview.html", context)


@admin_required
def person_new(request):
    from users.models import ChatUser
    form = GalleryPersonForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        person = form.save()
        messages.success(request, f"Person “{person.nick_name}” created. Share this code: {person.passcode}")
        return redirect("galleryedit_home")
    chat_users = ChatUser.objects.filter(is_active=True).exclude(user_id="admin")
    return render(
        request,
        "gallery/edit/person_form.html",
        {"form": form, "is_new": True, "chat_users": chat_users},
    )


@admin_required
def person_edit(request, pk):
    from users.models import ChatUser
    person = get_object_or_404(GalleryPerson, pk=pk)
    form = GalleryPersonForm(request.POST or None, instance=person)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, f"Person “{person.nick_name}” updated.")
        return redirect("galleryedit_home")
    chat_users = ChatUser.objects.filter(is_active=True).exclude(user_id="admin")
    return render(
        request,
        "gallery/edit/person_form.html",
        {"form": form, "is_new": False, "person": person, "chat_users": chat_users},
    )


@admin_required
@require_POST
def person_delete(request, pk):
    person = get_object_or_404(GalleryPerson, pk=pk)
    person.delete()  # sites fall back to public via SET_NULL
    messages.success(request, f"Person “{person.nick_name}” deleted. Their sites are now public.")
    return redirect("galleryedit_home")


# ─────────────────────────────────────────────────────────────
# Sites
# ─────────────────────────────────────────────────────────────

@admin_required
def site_new(request):
    if not unregistered_site_folders():
        messages.info(
            request,
            "No unregistered folders under backend/sites/. Add a folder (with index.html) and reload.",
        )
    form = GallerySiteNewForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        site = form.save()
        messages.success(request, f"Site “{site.nick_name}” registered.")
        return redirect("galleryedit_home")
    return render(request, "gallery/edit/site_form.html", {"form": form, "is_new": True})


@admin_required
def site_edit(request, pk):
    site = get_object_or_404(GallerySite, pk=pk)
    form = GallerySiteForm(request.POST or None, instance=site)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, f"Site “{site.nick_name}” updated.")
        return redirect("galleryedit_home")
    return render(
        request,
        "gallery/edit/site_form.html",
        {"form": form, "is_new": False, "site": site},
    )


@admin_required
@require_POST
def site_delete(request, pk):
    site = get_object_or_404(GallerySite, pk=pk)
    nick = site.nick_name
    site.delete()  # files stay on disk; the folder can be re-registered later
    messages.success(request, f"Site “{nick}” unregistered (files kept on disk).")
    return redirect("galleryedit_home")


@admin_required
@require_POST
def site_set_default(request, pk):
    site = get_object_or_404(GallerySite, pk=pk)
    if site.person:
        messages.error(request, "The /gallery default must be a public site — remove its person first.")
    else:
        site.is_default = True
        site.save()
        messages.success(request, f"“{site.nick_name}” is now the site everyone sees on /gallery.")
    return redirect("galleryedit_home")


@admin_required
@require_POST
def site_set_current(request, pk):
    site = get_object_or_404(GallerySite, pk=pk)
    site.is_current = True
    site.save()
    messages.success(request, f"“{site.nick_name}” is now live on /birthday.")
    return redirect("galleryedit_home")


# ─────────────────────────────────────────────────────────────
# Site assets (Supabase gallery/<slug>/, local fallback)
# ─────────────────────────────────────────────────────────────

@admin_required
def site_assets(request, pk):
    site = get_object_or_404(GallerySite, pk=pk)
    storage = gallery_asset_storage(site.slug)
    remote = _walk_storage_files(storage) if supabase_configured() else []
    context = {
        "site": site,
        "remote_files": remote,
        "local_files": sorted(local_asset_names(site.slug)),
        "missing": missing_asset_names(site.slug, remote_names=set(remote)),
        "storage_remote": supabase_configured(),
    }
    return render(request, "gallery/edit/site_assets.html", context)


def _clean_upload_name(name: str) -> str:
    name = os.path.basename(name.replace("\\", "/")).strip()
    return name.lstrip(".")


@admin_required
@require_POST
def site_assets_upload(request, pk):
    site = get_object_or_404(GallerySite, pk=pk)
    storage = gallery_asset_storage(site.slug)
    saved = []
    skipped = []
    for uploaded in request.FILES.getlist("files"):
        name = _clean_upload_name(uploaded.name)
        if not name:
            skipped.append(uploaded.name)
            continue
        storage.save(name, uploaded)
        saved.append(name)
    if saved:
        messages.success(request, f"Uploaded to {site.slug}: {', '.join(saved)}")
    if skipped:
        messages.warning(request, f"Skipped (bad name): {', '.join(skipped)}")
    return redirect("galleryedit_site_assets", pk=site.pk)


@admin_required
@require_POST
def site_asset_delete(request, pk, name):
    site = get_object_or_404(GallerySite, pk=pk)
    if ".." in name or name.startswith("/"):
        raise Http404()
    gallery_asset_storage(site.slug).delete(name)
    messages.success(request, f"Deleted {name} from {site.slug}.")
    return redirect("galleryedit_site_assets", pk=site.pk)
