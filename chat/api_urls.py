"""API URL configuration for chat messages."""
from django.urls import path
from chat.api_views import (
    MessageLatestView,
    MessageListView,
    MessageSeenView,
    MessageSendView,
)

urlpatterns = [
    path("", MessageListView.as_view(), name="api_messages_list"),
    path("latest/", MessageLatestView.as_view(), name="api_messages_latest"),
    path("send/", MessageSendView.as_view(), name="api_messages_send"),
    path("seen/", MessageSeenView.as_view(), name="api_messages_seen"),
]
