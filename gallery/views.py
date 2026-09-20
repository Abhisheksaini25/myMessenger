"""Public gallery views — no login required.

A visitor sees the default site embedded on /gallery; entering a person's
passcode unlocks that person's sites for the browser session. Admins
(superuser/staff) see everything without a passcode.
"""
import mimetypes
import os
import time
from pathlib import Path
from urllib.parse import urlparse

from django.http import FileResponse, Http404, HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt

from .models import GalleryMemory, GalleryPerson, GallerySite
from .services import (
    find_person_by_passcode,
    folder_has_site,
    is_gallery_admin,
    mark_person_unlocked,
    mark_site_shared_unlocked,
    register_unlock_attempt,
    shared_site_slugs,
    site_folder,
    unlock_attempts_exceeded,
    unlocked_person_ids,
    verify_site_share_token,
)

CONTENT_TYPE_OVERRIDES = {
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
}


def content_type_for(name: str) -> str:
    suffix = Path(name).suffix.lower()
    if suffix in CONTENT_TYPE_OVERRIDES:
        return CONTENT_TYPE_OVERRIDES[suffix]
    return mimetypes.guess_type(name)[0] or "application/octet-stream"


def safe_next_url(candidate: str, fallback: str) -> str:
    """Only allow same-site relative paths as post-unlock redirect targets."""
    if candidate and candidate.startswith("/") and not candidate.startswith("//"):
        return candidate
    return fallback


def can_view_site(request, site: GallerySite) -> bool:
    """Public sites and the current /birthday site are open; person sites need
    the passcode (or an admin session), or a valid shared-site session."""
    if site.person_id is None or site.is_current:
        return True
    if is_gallery_admin(request):
        return True
    # Passcode owner unlock (grants access to all person's sites & enables chat)
    if site.person_id in unlocked_person_ids(request):
        return True
    # Guest view-only unlock for this specific site via share link (NO chat)
    if site.slug in shared_site_slugs(request):
        return True
    return False


def serve_site_index(request, site: GallerySite) -> HttpResponse:
    index = site_folder(site.slug) / "index.html"
    if not index.is_file():
        raise Http404("Site files are missing.")
    html = index.read_text(encoding="utf-8", errors="replace")
    response = HttpResponse(html, content_type="text/html; charset=utf-8")
    # The /gallery wrapper embeds sites in a same-origin iframe. Django's global
    # X-Frame-Options default is DENY, which Chrome reports as "refused to
    # connect" — relax just the site pages to same-origin.
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


def serve_site_asset(request, site: GallerySite, asset: str) -> HttpResponse:
    if not asset or asset.endswith("/"):
        raise Http404()
    root = site_folder(site.slug).resolve()
    target = (root / asset).resolve()
    if not target.is_relative_to(root):
        raise Http404()
    if target.is_file():
        response = FileResponse(target.open("rb"))
        response["Content-Type"] = content_type_for(target.name)
        return response

    # Also check local disk under an assets/ subfolder if not prefixed
    if not asset.startswith("assets/"):
        assets_target = (root / "assets" / asset).resolve()
        if assets_target.is_relative_to(root) and assets_target.is_file():
            response = FileResponse(assets_target.open("rb"))
            response["Content-Type"] = content_type_for(assets_target.name)
            return response

    # Not on disk — fall back to the site's Supabase asset folder (gallery/<slug>/).
    from .storage import fetch_gallery_object

    data = fetch_gallery_object(site.slug, asset)
    if data is None and "/" in asset:
        # Check flat filename in Supabase bucket
        data = fetch_gallery_object(site.slug, Path(asset).name)
    elif data is None and not asset.startswith("assets/"):
        # Check assets/ prefixed path in Supabase bucket
        data = fetch_gallery_object(site.slug, f"assets/{asset}")

    if data is None:
        raise Http404("Asset not found.")
    return HttpResponse(data, content_type=content_type_for(asset))


@method_decorator(never_cache, name="dispatch")
class GalleryHomeView(View):
    """GET /gallery/ — default site embedded, archive panel beside it."""

    def get(self, request):
        default_site = GallerySite.objects.filter(is_default=True).first()
        unlocked_ids = unlocked_person_ids(request)
        unlocked_persons = (
            GalleryPerson.objects.filter(id__in=unlocked_ids).prefetch_related("sites")
            if unlocked_ids
            else GalleryPerson.objects.none()
        )
        public_sites = GallerySite.objects.filter(person__isnull=True).exclude(
            pk=default_site.pk if default_site else None
        )
        admin = is_gallery_admin(request)

        # Check if any unlocked person has an API key configured with an active ChatUser
        chat_enabled = False
        chat_user = None
        chat_person = None
        for person in reversed(list(unlocked_persons)):
            if person.api_key:
                matched_user = person.get_chat_user()
                if matched_user:
                    chat_enabled = True
                    chat_user = matched_user
                    chat_person = person
                    break

        context = {
            "default_site": default_site,
            "public_sites": public_sites,
            "unlocked_persons": unlocked_persons,
            "all_persons": (
                GalleryPerson.objects.prefetch_related("sites") if admin else None
            ),
            "is_admin": admin,
            "chat_enabled": chat_enabled,
            "chat_user": chat_user,
            "chat_person": chat_person,
            "unlock_error": request.GET.get("error", ""),
            "next_url": safe_next_url(
                request.POST.get("next", "") or request.get_full_path(), "/"
            ),
        }
        return render(request, "gallery/gallery.html", context)


class GalleryUnlockView(View):
    """POST /gallery/unlock/ — store the person id in the session on a match."""

    def post(self, request):
        fallback = reverse("gallery_home")
        next_url = safe_next_url(request.POST.get("next", ""), fallback)
        separator = "&" if urlparse(next_url).query else "?"
        code = request.POST.get("passcode", "")

        if unlock_attempts_exceeded(request):
            return redirect(f"{next_url}{separator}error=locked")

        person = find_person_by_passcode(code) if code.strip() else None
        if person is None:
            register_unlock_attempt(request)
            return redirect(f"{next_url}{separator}error=1")

        mark_person_unlocked(request, person.pk)
        return redirect(next_url)


@method_decorator(never_cache, name="dispatch")
class GallerySiteView(View):
    """GET /gallery/site/<slug>/ — gated index.html serving (supports ?share= or ?code= auto-unlock)."""

    def get(self, request, slug):
        site = get_object_or_404(GallerySite, slug=slug)
        if not can_view_site(request, site):
            # Check for candidate share token or passcode in query parameters
            token = request.GET.get("share") or request.GET.get("code")
            if token and verify_site_share_token(site, token):
                mark_site_shared_unlocked(request, site.slug)
            else:
                return render(
                    request,
                    "gallery/locked.html",
                    {"next": request.get_full_path()},
                    status=403,
                )
        return serve_site_index(request, site)


@method_decorator(never_cache, name="dispatch")
class GalleryShareLinkView(View):
    """GET /gallery/share/<slug>/<token>/ — direct share link for a person's site."""

    def get(self, request, slug, token):
        site = get_object_or_404(GallerySite, slug=slug)
        if not verify_site_share_token(site, token):
            return render(
                request,
                "gallery/locked.html",
                {"next": reverse("gallery_site", kwargs={"slug": slug})},
                status=403,
            )
        mark_site_shared_unlocked(request, site.slug)
        return redirect(reverse("gallery_site", kwargs={"slug": slug}))



@method_decorator(never_cache, name="dispatch")
class GallerySiteAssetView(View):
    """GET /gallery/site/<slug>/<asset> — gated files (css/js/images/audio/fonts)."""

    def get(self, request, slug, asset):
        site = get_object_or_404(GallerySite, slug=slug)
        if not can_view_site(request, site):
            return HttpResponse("This gallery site is locked.", status=403)
        return serve_site_asset(request, site, asset)


# ─────────────────────────────────────────────────────────────
# /birthday — serves whichever site is marked current
# ─────────────────────────────────────────────────────────────

@method_decorator(never_cache, name="dispatch")
class BirthdayCurrentView(View):
    """GET /birthday/ — the current wish site, or a placeholder if none."""

    def get(self, request):
        site = GallerySite.objects.filter(is_current=True).first()
        if site:
            return serve_site_index(request, site)
        return render(request, "gallery/birthday_placeholder.html")


@method_decorator(never_cache, name="dispatch")
class BirthdayAssetView(View):
    """GET /birthday/<asset> — files for the current site (relative refs)."""

    def get(self, request, asset):
        site = GallerySite.objects.filter(is_current=True).first()
        if not site:
            raise Http404()
        return serve_site_asset(request, site, asset)


# ─────────────────────────────────────────────────────────────
# Site Memories API (Supabase Storage /gallery/<slug>/memories/)
# ─────────────────────────────────────────────────────────────

@method_decorator(csrf_exempt, name="dispatch")
@method_decorator(never_cache, name="dispatch")
class GallerySiteMemoriesView(View):
    """
    GET /gallery/site/<slug>/memories/
    POST /gallery/site/<slug>/memories/upload/
    """

    def get_site(self, slug: str):
        site = GallerySite.objects.filter(slug=slug).first()
        if not site and folder_has_site(slug):
            person = None
            if "aku" in slug.lower():
                person = GalleryPerson.objects.filter(nick_name__iexact="Aku").first()
            site = GallerySite.objects.create(
                slug=slug,
                nick_name=slug.capitalize(),
                person=person,
            )
        return site

    def get(self, request, slug):
        site = self.get_site(slug)
        if not site:
            return JsonResponse({"memories": []})
        memories = [
            {
                "id": m.id,
                "name": m.name,
                "url": m.image_url,
                "created_at": m.created_at.isoformat(),
            }
            for m in site.memories.all()
        ]
        return JsonResponse({"memories": memories, "count": len(memories)})

    def post(self, request, slug):
        from .storage import gallery_asset_storage, gallery_object_url

        site = self.get_site(slug)
        if not site:
            return JsonResponse({"error": "Site not found."}, status=404)

        files = request.FILES.getlist("files")
        if not files:
            f = request.FILES.get("image") or request.FILES.get("file")
            if f:
                files = [f]

        if not files:
            return JsonResponse({"error": "No files provided."}, status=400)

        storage = gallery_asset_storage(site.slug)
        created_memories = []

        for uploaded in files:
            orig_name = uploaded.name.strip()
            clean_name = os.path.basename(orig_name.replace("\\", "/")).strip().lstrip(".")
            if not clean_name:
                continue
            unique_name = f"memories/{int(time.time() * 1000)}_{clean_name}"
            saved_name = storage.save(unique_name, uploaded)

            public_url = gallery_object_url(site.slug, saved_name)
            if not public_url:
                public_url = f"/gallery/site/{site.slug}/{saved_name}"

            memory = GalleryMemory.objects.create(
                site=site,
                name=clean_name,
                file_name=saved_name,
                image_url=public_url,
            )
            created_memories.append({
                "id": memory.id,
                "name": memory.name,
                "url": memory.image_url,
                "created_at": memory.created_at.isoformat(),
            })

        return JsonResponse({
            "status": "ok",
            "memories": created_memories,
            "count": len(created_memories),
        }, status=201)

