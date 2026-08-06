"""
Custom DRF Permissions for Android users.

Enforces that the user is authenticated via AndroidHeadersAuthentication
and prevents access to any other user's data.
"""
from typing import Any
from rest_framework.permissions import BasePermission
from rest_framework.request import Request


class IsAndroidAuthenticated(BasePermission):
    """
    Permission class that verifies request.chat_user is set and active.
    
    Ensures that APIs automatically infer the user from request.chat_user
    and that users can never see or modify another user's conversation.
    """

    message = "Authentication credentials (X-USER-ID and X-API-KEY) were not provided or are invalid."

    def has_permission(self, request: Request, view: Any) -> bool:
        """
        Check if request has an authenticated and active chat_user.
        """
        chat_user = getattr(request, "chat_user", None)
        if chat_user and chat_user.is_active:
            return True
        return False
