from django.urls import path
from .views import (
    AdminOverviewView,
    ConnectGmailView,
    EmailArchiveView,
    EmailAttachmentDownloadView,
    EmailDetailView,
    EmailEmptyTrashView,
    EmailFolderListView,
    EmailForwardView,
    EmailListView,
    EmailMarkReadView,
    EmailMarkUnreadView,
    EmailModifyLabelsView,
    EmailReplyView,
    EmailRestoreView,
    EmailSendView,
    EmailStarView,
    EmailTrashView,
    EmailUnstarView,
    GmailAccountDetailView,
    GmailAccountListView,
    GmailAccountProfileView,
    GmailOAuthCallbackView,
)

urlpatterns = [
    # Gmail Account Connection & Management
    path("accounts/", GmailAccountListView.as_view(), name="gmail-account-list"),
    path("accounts/connect/", ConnectGmailView.as_view(), name="gmail-account-connect"),
    path("oauth/callback/", GmailOAuthCallbackView.as_view(), name="gmail-oauth-callback"),
    path("accounts/<int:pk>/", GmailAccountDetailView.as_view(), name="gmail-account-detail"),
    path("accounts/<int:pk>/profile/", GmailAccountProfileView.as_view(), name="gmail-account-profile"),

    # Admin global overview
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-gmail-overview"),

    # Email Folder & Search listings
    path("accounts/<int:pk>/emails/", EmailListView.as_view(), name="email-list"),
    path("accounts/<int:pk>/search/", EmailListView.as_view(), name="email-search"),
    path("accounts/<int:pk>/folders/<str:folder>/", EmailFolderListView.as_view(), name="email-folder-list"),

    # Send email & Empty Trash
    path("accounts/<int:pk>/send/", EmailSendView.as_view(), name="email-send"),
    path("accounts/<int:pk>/trash/empty/", EmailEmptyTrashView.as_view(), name="email-empty-trash"),

    # Single Email Actions: Read, Permanent Delete, Attachment
    path("accounts/<int:pk>/emails/<str:message_id>/", EmailDetailView.as_view(), name="email-detail"),
    path(
        "accounts/<int:pk>/emails/<str:message_id>/attachments/<str:attachment_id>/",
        EmailAttachmentDownloadView.as_view(),
        name="email-attachment-download",
    ),

    # Send actions: Reply and Forward
    path("accounts/<int:pk>/emails/<str:message_id>/reply/", EmailReplyView.as_view(), name="email-reply"),
    path("accounts/<int:pk>/emails/<str:message_id>/forward/", EmailForwardView.as_view(), name="email-forward"),

    # State & Label actions: Trash, Restore, Read/Unread, Star/Unstar, Archive, Labels
    path("accounts/<int:pk>/emails/<str:message_id>/trash/", EmailTrashView.as_view(), name="email-trash"),
    path("accounts/<int:pk>/emails/<str:message_id>/restore/", EmailRestoreView.as_view(), name="email-restore"),
    path("accounts/<int:pk>/emails/<str:message_id>/read/", EmailMarkReadView.as_view(), name="email-mark-read"),
    path("accounts/<int:pk>/emails/<str:message_id>/unread/", EmailMarkUnreadView.as_view(), name="email-mark-unread"),
    path("accounts/<int:pk>/emails/<str:message_id>/star/", EmailStarView.as_view(), name="email-star"),
    path("accounts/<int:pk>/emails/<str:message_id>/unstar/", EmailUnstarView.as_view(), name="email-unstar"),
    path("accounts/<int:pk>/emails/<str:message_id>/archive/", EmailArchiveView.as_view(), name="email-archive"),
    path("accounts/<int:pk>/emails/<str:message_id>/labels/", EmailModifyLabelsView.as_view(), name="email-modify-labels"),
]
