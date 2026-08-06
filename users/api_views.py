"""
REST API views for the users app.

Includes the /api/ping/ endpoint for updating last_seen.
"""
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from users.services import update_last_seen


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
