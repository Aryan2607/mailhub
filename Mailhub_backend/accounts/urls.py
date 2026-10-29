from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AdminSendWebSocketEventView,
    AdminUserDetailView,
    AdminUserImageDownloadView,
    AdminUserImageListView,
    AdminUserListView,
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    UserImageDetailView,
    UserImageListView,
    UserImageUploadView,
    UserPendingEventsView,
    UserResumeDownloadView,
    UserResumeView,
)

urlpatterns = [
    # Auth endpoints
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="auth-password-reset"),
    path("password-reset-confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),

    # Google Drive Image Management
    path("images/upload/", UserImageUploadView.as_view(), name="user-image-upload"),
    path("images/", UserImageListView.as_view(), name="user-image-list"),
    path("images/<int:pk>/", UserImageDetailView.as_view(), name="user-image-detail"),

    # Admin Captured Images Management
    path("admin/images/", AdminUserImageListView.as_view(), name="admin-image-list"),
    path("admin/images/<int:pk>/download/", AdminUserImageDownloadView.as_view(), name="admin-image-download"),
    path("admin/users/<int:user_id>/images/", AdminUserImageListView.as_view(), name="admin-user-image-list"),

    # Resume management
    path("resume/", UserResumeView.as_view(), name="user-resume"),
    path("resume/download/", UserResumeDownloadView.as_view(), name="user-resume-download"),

    # Admin user management & WebSocket event dispatch
    path("events/pending/", UserPendingEventsView.as_view(), name="user-pending-events"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<int:user_id>/send-event/", AdminSendWebSocketEventView.as_view(), name="admin-user-send-event"),
    path("admin/send-event/", AdminSendWebSocketEventView.as_view(), name="admin-send-event"),
]
