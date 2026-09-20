"""API URL configuration for groups and contacts."""
from django.urls import path
from chat.api_views import (
    ContactListView,
    GroupListView,
    GroupMessageListView,
    GroupMessageSeenView,
    GroupMessageSendView,
)

urlpatterns = [
    path("contacts/", ContactListView.as_view(), name="api_contacts_list"),
    path("groups/", GroupListView.as_view(), name="api_groups_list"),
    path("groups/<str:slug>/messages/", GroupMessageListView.as_view(), name="api_group_messages"),
    path("groups/<str:slug>/send/", GroupMessageSendView.as_view(), name="api_group_send"),
    path("groups/<str:slug>/seen/", GroupMessageSeenView.as_view(), name="api_group_seen"),
]
