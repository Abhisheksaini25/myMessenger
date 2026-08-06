"""URL configuration for config project."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/messages/", include("chat.api_urls")),
    path("api/ping/", include("users.api_urls")),
    path("dashboard/", include("chat.dashboard_urls")),
    path("", RedirectView.as_view(url="/dashboard/", permanent=False), name="root_redirect"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
