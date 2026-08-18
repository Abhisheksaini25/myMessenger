"""
Debug middleware to log raw incoming headers on API requests.

This middleware runs BEFORE DRF authentication, so it will print
headers even when DRF rejects the request with 401.

Remove this middleware once debugging is complete.
"""
import logging

logger = logging.getLogger(__name__)


class DebugHeadersMiddleware:
    """
    Logs X-USER-ID and X-API-KEY headers for every /api/ request.
    Runs at the Django middleware level, before DRF authentication.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/"):
            user_id = request.META.get("HTTP_X_USER_ID", "NOT_PRESENT")
            api_key = request.META.get("HTTP_X_API_KEY", "NOT_PRESENT")
            print(f"\n{'='*60}")
            print(f"[DEBUG MIDDLEWARE] {request.method} {request.path}")
            print(f"[DEBUG MIDDLEWARE] X-USER-ID  = {user_id!r}")
            print(f"[DEBUG MIDDLEWARE] X-API-KEY   = {api_key!r}")
            print(f"[DEBUG MIDDLEWARE] Content-Type = {request.content_type!r}")
            # Print ALL headers that start with HTTP_ to spot name issues
            api_headers = {
                k: v for k, v in request.META.items()
                if k.startswith("HTTP_") and ("USER" in k or "API" in k or "KEY" in k)
            }
            print(f"[DEBUG MIDDLEWARE] All matching headers = {api_headers}")
            print(f"{'='*60}\n")

        response = self.get_response(request)
        return response
