"""API URL configuration for users app."""
from django.urls import path
from users.api_views import PingView, SaveFCMTokenView

urlpatterns = [
    path("ping/", PingView.as_view(), name="api_ping"),
    path("save-token/", SaveFCMTokenView.as_view(), name="api_save_fcm_token"),
]
