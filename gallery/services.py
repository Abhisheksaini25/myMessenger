import hashlib
import hmac
import os
import re
import time
from pathlib import Path

from django.conf import settings

from .models import GalleryPerson, GallerySite

SITES_DIR = Path(settings.BASE_DIR) / "sites"

UNLOCK_SESSION_KEY = "gallery_unlocked_person_ids"
SHARED_SITE_SESSION_KEY = "gallery_shared_site_slugs"
ATTEMPT_SESSION_KEY = "gallery_unlock_attempts"
MAX_ATTEMPTS = 10
ATTEMPT_WINDOW_SECONDS = 600

# Matches quoted asset paths (src="img.png", "med.mp3") and CSS url(...) forms.
# The path part excludes whitespace/angle brackets so prose in comments can't match.
ASSET_REF_RE = re.compile(
    r"""(?:["']|url\(\s*["']?)"""
    r"""([^"'\s<>()]+\.(?:png|jpe?g|gif|webp|svg|mp3|wav|ogg|ttf|otf|woff2?|mp4|webm|ico|avif))"""
    r"""(?:["']|\s*\))""",
    re.IGNORECASE,
)

TEXT_SUFFIXES = {".html", ".css", ".js"}


def is_gallery_admin(request) -> bool:
    """Same test as chat.views.admin_required, usable inside public views."""
    return request.user.is_authenticated and (request.user.is_superuser or request.user.is_staff)


# ─────────────────────────────────────────────────────────────
# Passcode unlock (anonymous, session-based)
# ─────────────────────────────────────────────────────────────

def find_person_by_passcode(code: str):
    return GalleryPerson.objects.filter(passcode__iexact=code.strip()).first()


def unlocked_person_ids(request) -> list:
    return [int(pk) for pk in request.session.get(UNLOCK_SESSION_KEY, [])]


def mark_person_unlocked(request, person_id: int) -> None:
    ids = request.session.get(UNLOCK_SESSION_KEY, [])
    if person_id not in ids:
        ids.append(person_id)
        request.session[UNLOCK_SESSION_KEY] = ids


def register_unlock_attempt(request) -> None:
    """Tiny session-based throttle so passcodes can't be brute-forced casually."""
    attempts = request.session.get(ATTEMPT_SESSION_KEY) or {}
    now = time.time()
    if now - attempts.get("ts", 0) > ATTEMPT_WINDOW_SECONDS:
        attempts = {"count": 0, "ts": now}
    attempts["count"] = attempts.get("count", 0) + 1
    attempts["ts"] = now
    request.session[ATTEMPT_SESSION_KEY] = attempts


def unlock_attempts_exceeded(request) -> bool:
    attempts = request.session.get(ATTEMPT_SESSION_KEY)
    if not attempts:
        return False
    if time.time() - attempts.get("ts", 0) > ATTEMPT_WINDOW_SECONDS:
        return False
    return attempts.get("count", 0) >= MAX_ATTEMPTS


# ─────────────────────────────────────────────────────────────
# Guest Share Link (view-only for a specific site, NO chat)
# ─────────────────────────────────────────────────────────────

def shared_site_slugs(request) -> list:
    """Return list of site slugs unlocked for this visitor via share link."""
    return list(request.session.get(SHARED_SITE_SESSION_KEY, []))


def mark_site_shared_unlocked(request, slug: str) -> None:
    """Unlock a specific site for viewing in the current session (does NOT unlock chat)."""
    slugs = request.session.get(SHARED_SITE_SESSION_KEY, [])
    if slug not in slugs:
        slugs.append(slug)
        request.session[SHARED_SITE_SESSION_KEY] = slugs


def generate_site_share_token(site) -> str:
    """
    Generate a 16-character HMAC token unique to this site and person.
    Tamper-proof and derived from SECRET_KEY.
    """
    secret = settings.SECRET_KEY.encode()
    person_key = site.person.passcode if site.person else "public"
    message = f"gallery_share:{site.slug}:{site.person_id}:{person_key}".encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()[:16]


def verify_site_share_token(site, token: str) -> bool:
    """
    Verify whether a candidate token (or raw passcode fallback) matches the site.
    """
    if not token or not token.strip():
        return False
    candidate = token.strip()
    expected = generate_site_share_token(site)
    if hmac.compare_digest(candidate, expected):
        return True
    # Allow the person's passcode as a valid candidate
    if site.person and candidate.lower() == site.person.passcode.strip().lower():
        return True
    return False



# ─────────────────────────────────────────────────────────────
# Site folders on disk
# ─────────────────────────────────────────────────────────────

def site_folder(slug: str) -> Path:
    return SITES_DIR / slug


def folder_has_site(slug: str) -> bool:
    return (site_folder(slug) / "index.html").is_file()


def unregistered_site_folders() -> list:
    """Folders under backend/sites/ that have no GallerySite row yet."""
    if not SITES_DIR.exists():
        return []
    known = set(GallerySite.objects.values_list("slug", flat=True))
    return sorted(
        p.name
        for p in SITES_DIR.iterdir()
        if p.is_dir() and p.name not in known and not p.name.startswith((".", "_"))
    )


def local_asset_names(slug: str) -> set:
    """All files in a site folder as relative posix paths (e.g. 'assets/img.png')."""
    root = site_folder(slug)
    if not root.exists():
        return set()
    return {
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and not p.name.startswith(".")
    }


def _resolve_ref(ref: str, from_file: Path, root: Path):
    """Resolve an asset reference (relative to the referencing file) to a
    posix path under the site root; None for external/absolute refs."""
    if ref.startswith(("http://", "https://", "data:", "//", "#")):
        return None
    if ref.startswith("/"):
        return None  # absolute URLs are served by Django/static, not site files
    resolved = os.path.normpath(os.path.join(os.path.relpath(from_file.parent, root), ref))
    resolved = resolved.replace("\\", "/")
    if resolved.startswith(".."):
        return None
    return resolved


def referenced_asset_names(slug: str) -> set:
    """Asset paths a site's html/css/js actually reference (site-root relative)."""
    root = site_folder(slug)
    refs = set()
    if not root.exists():
        return refs
    for path in root.rglob("*"):
        if path.suffix.lower() not in TEXT_SUFFIXES or not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for ref in ASSET_REF_RE.findall(text):
            resolved = _resolve_ref(ref, path, root)
            if resolved:
                refs.add(resolved)
    return refs


def missing_asset_names(slug: str, remote_names=None) -> list:
    """Referenced assets that exist neither locally nor in the site's remote asset folder."""
    known = local_asset_names(slug) | set(remote_names or ())
    return sorted(name for name in referenced_asset_names(slug) if name not in known)
