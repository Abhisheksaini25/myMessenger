"""Admin gallery editor URL configuration (/galleryedit/)."""
from django.urls import path

from . import edit_views

urlpatterns = [
    path("", edit_views.galleryedit_home, name="galleryedit_home"),
    path("persons/new/", edit_views.person_new, name="galleryedit_person_new"),
    path("persons/<int:pk>/edit/", edit_views.person_edit, name="galleryedit_person_edit"),
    path("persons/<int:pk>/delete/", edit_views.person_delete, name="galleryedit_person_delete"),
    path("sites/new/", edit_views.site_new, name="galleryedit_site_new"),
    path("sites/<int:pk>/edit/", edit_views.site_edit, name="galleryedit_site_edit"),
    path("sites/<int:pk>/delete/", edit_views.site_delete, name="galleryedit_site_delete"),
    path("sites/<int:pk>/set-default/", edit_views.site_set_default, name="galleryedit_site_set_default"),
    path("sites/<int:pk>/set-current/", edit_views.site_set_current, name="galleryedit_site_set_current"),
    path("sites/<int:pk>/assets/", edit_views.site_assets, name="galleryedit_site_assets"),
    path("sites/<int:pk>/assets/upload/", edit_views.site_assets_upload, name="galleryedit_site_assets_upload"),
    path(
        "sites/<int:pk>/assets/delete/<str:name>/",
        edit_views.site_asset_delete,
        name="galleryedit_site_asset_delete",
    ),
]
