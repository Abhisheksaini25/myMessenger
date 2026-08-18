"""API URL configuration for users app."""
from django.urls import path
from users.api_views import PingView, save_fcm_token

urlpatterns = [
    path("", PingView.as_view(), name="api_ping"),
    path("save-token/", save_fcm_token),
]
