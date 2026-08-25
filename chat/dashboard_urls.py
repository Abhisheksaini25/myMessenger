"""Dashboard URL configuration for WhatsApp Web-style admin interface."""
from django.urls import path
from chat.views import (
    chat_messages_view,
    chat_window_view,
    conversation_list_view,
    dashboard_view,
    friend_simulator_view,
    memo_dashboard_view,
    memo_messages_view,
    memo_sidebar_view,
    memo_thread_view,
    send_message_view,
)

urlpatterns = [
    path("", dashboard_view, name="dashboard_home"),
    path("conversations/", conversation_list_view, name="dashboard_conversations"),
    path("chat/<str:user_id>/", chat_window_view, name="dashboard_chat_window"),
    path("chat/<str:user_id>/messages/", chat_messages_view, name="dashboard_chat_messages"),
    path("chat/<str:user_id>/send/", send_message_view, name="dashboard_chat_send"),
    path("simulator/", friend_simulator_view, name="dashboard_simulator"),
    path("simulator/<str:user_id>/", friend_simulator_view, name="dashboard_simulator_user"),
    # Memo (admin-only private channel)
    path("internal/", memo_dashboard_view, name="memo_dashboard"),
    path("internal/senders/", memo_sidebar_view, name="memo_sidebar"),
    path("internal/thread/<str:user_id>/", memo_thread_view, name="memo_thread"),
    path("internal/thread/<str:user_id>/feed/", memo_messages_view, name="memo_feed"),
]

