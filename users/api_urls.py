"""API URL configuration for users app."""
from django.urls import path
from users.api_views import PingView

urlpatterns = [
    path("", PingView.as_view(), name="api_ping"),
]
