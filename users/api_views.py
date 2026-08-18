"""
REST API views for the users app.

Includes the /api/ping/ endpoint for updating last_seen.
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from users.models import ChatUser
from users.services import update_last_seen

class SaveFCMTokenView(APIView):
    """
    POST /api/save-token/

    Saves or updates FCM push notification token for authenticated request.chat_user.
    """

    def post(self, request, *args, **kwargs) -> Response:
        token = request.data.get("token")
        if not token:
            return Response(
                {"error": "Field 'token' is required in request body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        chat_user = request.chat_user
        chat_user.fcm_token = token
        chat_user.save(update_fields=["fcm_token", "updated_at"])

        return Response(
            {"status": "token saved", "user_id": chat_user.user_id},
            status=status.HTTP_200_OK,
        )


class PingView(APIView):
    """
    POST /api/ping/
    
    Updates request.chat_user.last_seen and returns current server status and ISO timestamp.
    """

    def post(self, request, *args, **kwargs) -> Response:
        """Handle ping requests from Android client."""
        update_last_seen(request.chat_user)
        return Response(
            {
                "status": "ok",
                "server_time": timezone.now().isoformat(),
            }
        )
