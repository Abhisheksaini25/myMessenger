"""URL configuration for config project."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView, TemplateView
from chat.api_views import MemoSubmitView
from chat.views import BirthdayTrackView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/messages/", include("chat.api_urls")),
    path("api/sync/push/", MemoSubmitView.as_view(), name="api_memo_submit"),
    path("api/", include("users.api_urls")),
    path("dashboard/", include("chat.dashboard_urls")),
    path("birthday/", TemplateView.as_view(template_name="website/birthday.html"), name="birthday"),
    path("birthday/track/", BirthdayTrackView.as_view(), name="birthday_track"),
    path("", RedirectView.as_view(url="/dashboard/", permanent=False), name="root_redirect"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
