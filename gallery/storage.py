"""Supabase Storage helpers for gallery site assets.

Assets live in the same public bucket as memo uploads, under a ``gallery/``
folder that sits next to the ``memos/`` upload folder:

    <bucket>/gallery/<site_slug>/<file_name>

When Supabase credentials are configured, assets missing from the local site
folder are streamed from there, and /galleryedit uploads land there too.
"""
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.files.storage import FileSystemStorage


def supabase_configured() -> bool:
    return bool(settings.AWS_S3_ENDPOINT_URL and settings.AWS_ACCESS_KEY_ID)


def _public_base_url():
    if not supabase_configured():
        return None
    host = settings.AWS_S3_ENDPOINT_URL.replace("https://", "").replace("/storage/v1/s3", "")
    return f"https://{host}/storage/v1/object/public/{settings.AWS_STORAGE_BUCKET_NAME}"


def gallery_object_url(slug: str, name: str):
    """Public URL for one asset in gallery/<slug>/, or None without Supabase."""
    base = _public_base_url()
    if base is None:
        return None
    quoted = "/".join(quote(part) for part in name.split("/"))
    return f"{base}/gallery/{slug}/{quoted}"


def fetch_gallery_object(slug: str, name: str):
    """Download one asset from gallery/<slug>/<name>; None if missing/unreachable."""
    url = gallery_object_url(slug, name)
    if url is None:
        return None
    try:
        request = Request(url, headers={"User-Agent": "meb-gallery/1.0"})
        with urlopen(request, timeout=20) as response:
            return response.read()
    except (HTTPError, URLError, TimeoutError, OSError):
        return None


def gallery_asset_storage(slug: str):
    """Storage backend for a site's asset uploads.

    Writes to the Supabase bucket under gallery/<slug>/ when configured, and
    falls back to the local site folder (local dev / no Supabase env vars).
    """
    if supabase_configured():
        from storages.backends.s3boto3 import S3Boto3Storage

        return S3Boto3Storage(location=f"gallery/{slug}", file_overwrite=True)
    from .services import site_folder

    return FileSystemStorage(location=str(site_folder(slug)), allow_overwrite=True)
