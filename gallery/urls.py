"""Public gallery URL configuration."""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.GalleryHomeView.as_view(), name="gallery_home"),
    path("unlock/", views.GalleryUnlockView.as_view(), name="gallery_unlock"),
    path("site/<slug:slug>/", views.GallerySiteView.as_view(), name="gallery_site"),
    path("site/<slug:slug>/memories/", views.GallerySiteMemoriesView.as_view(), name="gallery_site_memories"),
    path("site/<slug:slug>/memories/upload/", views.GallerySiteMemoriesView.as_view(), name="gallery_site_memories_upload"),
    path("share/<slug:slug>/<str:token>/", views.GalleryShareLinkView.as_view(), name="gallery_share_link"),
    path(
        "site/<slug:slug>/<path:asset>",
        views.GallerySiteAssetView.as_view(),
        name="gallery_site_asset",
    ),
]
