"""URL configuration for config project."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from chat.api_views import MemoSubmitView
from chat.views import (
    BirthdayTrackView,
    admin_panel_view,
    admin_peer_permissions_view,
    admin_groups_view,
    admin_group_create_view,
    admin_group_edit_view,
    admin_group_delete_view,
)
from gallery.views import BirthdayAssetView, BirthdayCurrentView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("panel/", admin_panel_view, name="admin_panel"),
    path("panel/permissions/", admin_peer_permissions_view, name="admin_peer_permissions"),
    path("panel/groups/", admin_groups_view, name="admin_groups"),
    path("panel/groups/new/", admin_group_create_view, name="admin_group_create"),
    path("panel/groups/<str:slug>/edit/", admin_group_edit_view, name="admin_group_edit"),
    path("panel/groups/<str:slug>/delete/", admin_group_delete_view, name="admin_group_delete"),
    path("api/messages/", include("chat.api_urls")),
    path("api/sync/push/", MemoSubmitView.as_view(), name="api_memo_submit"),
    path("api/", include("chat.group_api_urls")),
    path("api/", include("users.api_urls")),
    path("dashboard/", include("chat.dashboard_urls")),
    path("gallery/", include("gallery.urls")),
    path("galleryedit/", include("gallery.edit_urls")),
    # /birthday serves whichever gallery site is marked current; /birthday/track/
    # must stay listed before the asset catch-all below.
    path("birthday/track/", BirthdayTrackView.as_view(), name="birthday_track"),
    path("birthday/", BirthdayCurrentView.as_view(), name="birthday"),
    path("birthday/<path:asset>", BirthdayAssetView.as_view(), name="birthday_asset"),
    path("", RedirectView.as_view(url="/dashboard/", permanent=False), name="root_redirect"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
