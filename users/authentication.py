"""
Custom DRF Authentication for Android users.

Reads X-USER-ID and X-API-KEY headers from the request.
Validates against active ChatUser records in PostgreSQL/SQLite.
"""
from typing import Optional, Tuple
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from users.models import ChatUser


class AndroidHeadersAuthentication(BaseAuthentication):
    """
    Authentication class for Android APK clients.
    
    Validates X-USER-ID and X-API-KEY headers.
    If valid, attaches ChatUser instance to request.chat_user and returns (chat_user, None).
    Otherwise raises AuthenticationFailed (HTTP 401).
    """

    def authenticate(self, request: Request) -> Optional[Tuple[ChatUser, None]]:
        """
        Authenticate the request using X-USER-ID and X-API-KEY headers.

        Returns:
            Tuple of (ChatUser, None) if authenticated, or raises AuthenticationFailed.
        """
        user_id = request.headers.get("X-USER-ID") or request.META.get("HTTP_X_USER_ID")
        api_key = request.headers.get("X-API-KEY") or request.META.get("HTTP_X_API_KEY")

        if not user_id or not api_key:
            return None

        # Do not allow external APKs to authenticate as the internal admin counterpart
        if user_id == "admin":
            raise AuthenticationFailed("Invalid user credentials.")

        chat_user = (
            ChatUser.objects.filter(
                user_id=user_id,
                api_key=api_key,
                is_active=True,
            ).first()
        )

        if not chat_user:
            raise AuthenticationFailed("Invalid X-USER-ID or X-API-KEY.")

        # Attach to request.chat_user as specified
        request.chat_user = chat_user

        return (chat_user, None)

    def authenticate_header(self, request: Request) -> str:
        """
        Return custom header scheme for HTTP 401 responses.
        """
        return "X-API-KEY"
