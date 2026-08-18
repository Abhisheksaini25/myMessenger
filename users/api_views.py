"""
REST API views for the users app.

Includes the /api/ping/ endpoint for updating last_seen.
"""
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView
from users.services import update_last_seen
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(["POST"])
def save_fcm_token(request):
    user_id = request.headers.get("X-USER-ID")
    api_key = request.headers.get("X-API-KEY")

    token = request.data.get("token")

    try:
        user = Friend.objects.get(
            name=user_id,
            api_key=api_key
        )
    except Friend.DoesNotExist:
        return Response({"error": "Invalid user"}, status=403)

    user.fcm_token = token
    user.save()

    return Response({"status": "token saved"})


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
