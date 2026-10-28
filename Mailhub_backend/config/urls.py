"""
URL configuration for MailHub multi-account Gmail management system.
"""

from django.contrib import admin
from django.urls import include, path
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    """MailHub API Root and documentation summary."""
    return Response({
        "name": "MailHub Multi-Account Gmail Management API",
        "version": "v1",
        "description": "Multi-account Gmail management system with dual roles (Normal User and Admin).",
        "endpoints": {
            "authentication": {
                "register": "/api/v1/auth/register/ [POST]",
                "login": "/api/v1/auth/login/ [POST]",
                "logout": "/api/v1/auth/logout/ [POST]",
                "token_refresh": "/api/v1/auth/token/refresh/ [POST]",
                "me": "/api/v1/auth/me/ [GET, PATCH]",
                "change_password": "/api/v1/auth/change-password/ [POST]",
                "password_reset": "/api/v1/auth/password-reset/ [POST]",
                "password_reset_confirm": "/api/v1/auth/password-reset-confirm/ [POST]",
            },
            "admin_management": {
                "admin_overview": "/api/v1/gmail/admin/overview/ [GET]",
                "admin_users": "/api/v1/auth/admin/users/ [GET]",
                "admin_user_detail": "/api/v1/auth/admin/users/<id>/ [GET, PATCH, DELETE]",
            },
            "gmail_accounts": {
                "list_accounts": "/api/v1/gmail/accounts/ [GET]",
                "connect_oauth": "/api/v1/gmail/accounts/connect/ [POST]",
                "oauth_callback": "/api/v1/gmail/oauth/callback/ [GET]",
                "account_detail": "/api/v1/gmail/accounts/<id>/ [GET]",
                "disconnect_account": "/api/v1/gmail/accounts/<id>/ [DELETE]",
                "account_profile": "/api/v1/gmail/accounts/<id>/profile/ [GET]",
            },
            "emails": {
                "inbox_emails": "/api/v1/gmail/accounts/<id>/emails/ [GET]",
                "folder_emails": "/api/v1/gmail/accounts/<id>/folders/<folder>/ [GET] (folders: inbox, sent, drafts, trash, spam, starred, important)",
                "search_emails": "/api/v1/gmail/accounts/<id>/search/?q=<query> [GET]",
                "email_detail": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/ [GET]",
                "permanently_delete": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/ [DELETE]",
                "attachment_download": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/attachments/<attachment_id>/ [GET]",
                "send_email": "/api/v1/gmail/accounts/<id>/send/ [POST]",
                "reply_email": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/reply/ [POST]",
                "forward_email": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/forward/ [POST]",
                "move_to_trash": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/trash/ [POST]",
                "restore_from_trash": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/restore/ [POST]",
                "empty_trash": "/api/v1/gmail/accounts/<id>/trash/empty/ [POST]",
                "mark_as_read": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/read/ [POST]",
                "mark_as_unread": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/unread/ [POST]",
                "star_email": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/star/ [POST]",
                "unstar_email": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/unstar/ [POST]",
                "archive_email": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/archive/ [POST]",
                "modify_labels": "/api/v1/gmail/accounts/<id>/emails/<msg_id>/labels/ [PATCH]",
            },
        },
    })


urlpatterns = [
    path("admin/", admin.site.urls),
    path("", api_root, name="api-root-index"),
    path("api/v1/", api_root, name="api-root"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/gmail/", include("gmail_accounts.urls")),
]
