import mimetypes
from django.conf import settings
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from googleapiclient.errors import HttpError

from accounts.models import User
from accounts.permissions import IsAdminUserRole, IsOwnerOrAdmin

from .models import GmailAccount
from .serializers import (
    EmailForwardSerializer,
    EmailListQuerySerializer,
    EmailReplySerializer,
    EmailSendSerializer,
    GmailAccountSerializer,
    ModifyLabelsSerializer,
)
from .services import gemini_service, gmail_service, oauth_service


def get_account_or_404(account_id: int, user: User) -> GmailAccount:
    """
    Retrieves the GmailAccount.
    Allows access if user is Admin or Staff, or if user is the account owner.
    """
    account = get_object_or_404(GmailAccount, id=account_id)
    if not (getattr(user, "is_admin", False) or account.user == user):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied("You do not have permission to access this Gmail account.")
    return account


class GmailAccountListView(APIView):
    """
    List connected Gmail accounts or initiate a new connection.
    - Normal user: returns only accounts they own.
    - Admin user: returns all connected accounts across all users in the system.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "is_admin", False):
            user_id = request.query_params.get("user_id")
            if user_id:
                accounts = GmailAccount.objects.filter(user_id=user_id)
            else:
                accounts = GmailAccount.objects.all().select_related("user")
        else:
            accounts = GmailAccount.objects.filter(user=request.user)

        serializer = GmailAccountSerializer(accounts, many=True)
        return Response(serializer.data)


class ConnectGmailView(APIView):
    """
    Generate Google OAuth 2.0 authorization URL to connect a Gmail account.
    Returns the authorization URL and state token.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            auth_url, state_token = oauth_service.generate_authorization_url(request.user.id)
            return Response(
                {
                    "authorization_url": auth_url,
                    "state": state_token,
                    "message": "Redirect user to authorization_url to connect Gmail account.",
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GmailOAuthCallbackView(APIView):
    """
    Callback URL where Google redirects after user authorization.
    Verifies state token, exchanges code for credentials, and stores encrypted tokens.
    Redirects back to frontend with status message or returns JSON if requested.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        code = request.GET.get("code")
        state = request.GET.get("state")
        error = request.GET.get("error")

        from urllib.parse import quote
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        is_browser = "text/html" in request.headers.get("accept", "")

        if error:
            if is_browser:
                return redirect(f"{frontend_url}/?status=error&error={quote(str(error))}")
            return Response(
                {"error": f"Google OAuth error: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not code or not state:
            if is_browser:
                return redirect(f"{frontend_url}/?status=error&error=Missing+code+or+state+in+OAuth+callback")
            return Response(
                {"error": "Missing code or state parameter in OAuth callback."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            account = oauth_service.process_oauth_callback(code, state)

            if is_browser:
                return redirect(
                    f"{frontend_url}/?status=success&email={quote(account.email_address)}&account_id={account.id}"
                )

            return Response(
                {
                    "message": "Gmail account connected successfully.",
                    "account": GmailAccountSerializer(account).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            if is_browser:
                return redirect(f"{frontend_url}/?status=error&error={quote(str(e))}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """Allow frontend to POST code and state directly if frontend was the redirect target."""
        code = request.data.get("code")
        state = request.data.get("state")
        if not code or not state:
            return Response(
                {"error": "Missing code or state parameter in OAuth callback."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            account = oauth_service.process_oauth_callback(code, state)
            return Response(
                {
                    "message": "Gmail account connected successfully.",
                    "account": GmailAccountSerializer(account).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GmailAccountDetailView(APIView):
    """Retrieve details or disconnect a connected Gmail account."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        account = get_account_or_404(pk, request.user)
        serializer = GmailAccountSerializer(account)
        return Response(serializer.data)

    def delete(self, request, pk):
        account = get_account_or_404(pk, request.user)
        email_addr = account.email_address
        account.delete()
        return Response(
            {"message": f"Gmail account {email_addr} has been disconnected."},
            status=status.HTTP_200_OK,
        )


class GmailAccountProfileView(APIView):
    """Retrieve mailbox stats (total messages, threads, historyId)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        account = get_account_or_404(pk, request.user)
        try:
            profile = gmail_service.get_account_profile(account)
            return Response(profile)
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailListView(APIView):
    """
    Lists emails from inbox or any folder (sent, drafts, trash, spam, starred, important).
    Supports pagination via page_token and Gmail query syntax via q.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        account = get_account_or_404(pk, request.user)
        query_serializer = EmailListQuerySerializer(data=request.query_params)
        query_serializer.is_valid(raise_exception=True)
        params = query_serializer.validated_data

        try:
            data = gmail_service.list_emails(
                account=account,
                folder=params.get("folder", "inbox"),
                query=params.get("q", ""),
                page_token=params.get("page_token"),
                max_results=params.get("max_results", 20),
            )
            return Response(data)
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailFolderListView(APIView):
    """Lists emails for a designated folder route (e.g. /folders/sent/)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, folder):
        account = get_account_or_404(pk, request.user)
        query = request.query_params.get("q", "")
        page_token = request.query_params.get("page_token")
        max_results = int(request.query_params.get("max_results", 20))

        try:
            data = gmail_service.list_emails(
                account=account,
                folder=folder,
                query=query,
                page_token=page_token,
                max_results=max_results,
            )
            return Response(data)
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailDetailView(APIView):
    """
    Retrieve full details or permanently delete an email.
    Admin users can read and delete emails from any connected account.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            data = gmail_service.get_email_detail(account, message_id)
            return Response(data)
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, message_id):
        """Action 2: Permanently delete message."""
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.permanently_delete_email(account, message_id)
            return Response(result, status=status.HTTP_200_OK)
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailAttachmentDownloadView(APIView):
    """Download an attachment as a file stream."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, message_id, attachment_id):
        account = get_account_or_404(pk, request.user)
        filename = request.query_params.get("filename", "attachment")
        try:
            raw_bytes = gmail_service.download_attachment(account, message_id, attachment_id)
            content_type, _ = mimetypes.guess_type(filename)
            content_type = content_type or "application/octet-stream"

            response = HttpResponse(raw_bytes, content_type=content_type)
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            response["Content-Length"] = len(raw_bytes)
            return response
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailSendView(APIView):
    """
    Send a new email. Supports JSON or multipart/form-data for attachments.
    Admin users can also send from any connected account.
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        account = get_account_or_404(pk, request.user)

        # Parse To, CC, BCC whether passed as list or comma-separated string
        to_data = request.data.getlist("to") if hasattr(request.data, "getlist") and request.data.getlist("to") else request.data.get("to", [])
        if isinstance(to_data, str):
            to_data = [addr.strip() for addr in to_data.split(",") if addr.strip()]

        cc_data = request.data.getlist("cc") if hasattr(request.data, "getlist") and request.data.getlist("cc") else request.data.get("cc", [])
        if isinstance(cc_data, str):
            cc_data = [addr.strip() for addr in cc_data.split(",") if addr.strip()]

        bcc_data = request.data.getlist("bcc") if hasattr(request.data, "getlist") and request.data.getlist("bcc") else request.data.get("bcc", [])
        if isinstance(bcc_data, str):
            bcc_data = [addr.strip() for addr in bcc_data.split(",") if addr.strip()]

        data = {
            "to": to_data,
            "cc": cc_data,
            "bcc": bcc_data,
            "subject": request.data.get("subject", ""),
            "body_text": request.data.get("body_text", ""),
            "body_html": request.data.get("body_html", ""),
            "thread_id": None if not request.data.get("thread_id") or str(request.data.get("thread_id")).strip().lower() in ("null", "none", "undefined", "") else str(request.data.get("thread_id")).strip(),
        }

        serializer = EmailSendSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        # Extract file attachments from request.FILES
        attachments = list(request.FILES.values())

        # Support attaching stored UserResume automatically
        attach_resume = str(request.data.get("attach_resume", "")).lower() in ("true", "1", "yes")
        if attach_resume:
            user_resume = None
            if hasattr(request.user, "resume") and request.user.resume:
                user_resume = request.user.resume
            elif hasattr(account, "user") and hasattr(account.user, "resume") and account.user.resume:
                user_resume = account.user.resume
            elif getattr(request.user, "is_admin", False):
                from accounts.models import UserResume
                user_resume = UserResume.objects.first()
            if user_resume:
                file_bytes = user_resume.get_file_bytes() if hasattr(user_resume, "get_file_bytes") else b""
                if not file_bytes and user_resume.file:
                    try:
                        user_resume.file.open("rb")
                        file_bytes = user_resume.file.read()
                        user_resume.file.close()
                    except Exception:
                        pass
                if file_bytes:
                    class ResumeAttachmentWrapper:
                        def __init__(self, filename, content):
                            self.name = filename
                            self.content_type = "application/pdf" if filename.lower().endswith(".pdf") else "application/octet-stream"
                            self._content = content
                        def read(self):
                            return self._content
                    attachments.append(ResumeAttachmentWrapper(user_resume.original_filename, file_bytes))


        try:
            result = gmail_service.send_email(
                account=account,
                to=v["to"],
                subject=v["subject"],
                body_text=v.get("body_text", ""),
                body_html=v.get("body_html", ""),
                cc=v.get("cc"),
                bcc=v.get("bcc"),
                attachments=attachments if attachments else None,
                thread_id=v.get("thread_id"),
            )
            return Response(
                {"message": "Email sent successfully.", "result": result},
                status=status.HTTP_201_CREATED,
            )
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailReplyView(APIView):
    """Reply to an email maintaining thread headers."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        serializer = EmailReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        attachments = list(request.FILES.values())

        try:
            result = gmail_service.reply_email(
                account=account,
                message_id=message_id,
                body_text=v.get("body_text", ""),
                body_html=v.get("body_html", ""),
                cc=v.get("cc"),
                bcc=v.get("bcc"),
                attachments=attachments if attachments else None,
                reply_all=v.get("reply_all", False),
            )
            return Response(
                {"message": "Reply sent successfully.", "result": result},
                status=status.HTTP_201_CREATED,
            )
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailForwardView(APIView):
    """Forward an email to new recipients."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        to_data = request.data.getlist("to") if hasattr(request.data, "getlist") and request.data.getlist("to") else request.data.get("to", [])
        if isinstance(to_data, str):
            to_data = [addr.strip() for addr in to_data.split(",") if addr.strip()]

        cc_data = request.data.getlist("cc") if hasattr(request.data, "getlist") and request.data.getlist("cc") else request.data.get("cc", [])
        if isinstance(cc_data, str):
            cc_data = [addr.strip() for addr in cc_data.split(",") if addr.strip()]

        data = {
            "to": to_data,
            "cc": cc_data,
            "body_text": request.data.get("body_text", ""),
            "body_html": request.data.get("body_html", ""),
        }
        serializer = EmailForwardSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        attachments = list(request.FILES.values())

        try:
            result = gmail_service.forward_email(
                account=account,
                message_id=message_id,
                to=v["to"],
                cc=v.get("cc"),
                body_text=v.get("body_text", ""),
                body_html=v.get("body_html", ""),
                attachments=attachments if attachments else None,
            )
            return Response(
                {"message": "Email forwarded successfully.", "result": result},
                status=status.HTTP_201_CREATED,
            )
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailTrashView(APIView):
    """Action 1: Move an email to Trash."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.trash_email(account, message_id)
            return Response({"message": "Email moved to Trash.", "result": result})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailRestoreView(APIView):
    """Restore an email from Trash."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.untrash_email(account, message_id)
            return Response({"message": "Email restored from Trash.", "result": result})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailEmptyTrashView(APIView):
    """Empty Trash: permanently deletes all messages in Trash."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.empty_trash(account)
            return Response(result)
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailMarkReadView(APIView):
    """Mark email as read."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.mark_as_read(account, message_id)
            return Response({"message": "Email marked as read.", "labels": result.get("labelIds", [])})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailMarkUnreadView(APIView):
    """Mark email as unread."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.mark_as_unread(account, message_id)
            return Response({"message": "Email marked as unread.", "labels": result.get("labelIds", [])})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailStarView(APIView):
    """Star an email."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.star_email(account, message_id)
            return Response({"message": "Email starred.", "labels": result.get("labelIds", [])})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailUnstarView(APIView):
    """Unstar an email."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.unstar_email(account, message_id)
            return Response({"message": "Email unstarred.", "labels": result.get("labelIds", [])})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailArchiveView(APIView):
    """Archive an email (removes INBOX label)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        try:
            result = gmail_service.archive_email(account, message_id)
            return Response({"message": "Email archived.", "labels": result.get("labelIds", [])})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class EmailModifyLabelsView(APIView):
    """Add or remove custom labels."""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk, message_id):
        account = get_account_or_404(pk, request.user)
        serializer = ModifyLabelsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data

        try:
            result = gmail_service.modify_labels(
                account,
                message_id,
                add_labels=v.get("add_labels"),
                remove_labels=v.get("remove_labels"),
            )
            return Response({"message": "Labels updated.", "labels": result.get("labelIds", [])})
        except HttpError as e:
            return Response({"error": f"Gmail API error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# Admin-specific endpoint for global overview
class AdminOverviewView(APIView):
    """System overview for admins: counts of users and connected accounts."""
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_users = User.objects.count()
        admin_users = User.objects.filter(role=User.Role.ADMIN).count()
        normal_users = User.objects.filter(role=User.Role.USER).count()
        total_accounts = GmailAccount.objects.count()
        active_accounts = GmailAccount.objects.filter(is_active=True).count()

        users_list = []
        for u in User.objects.all().prefetch_related("gmail_accounts"):
            users_list.append({
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "is_active": u.is_active,
                "date_joined": u.date_joined.isoformat() if u.date_joined else None,
                "has_resume": hasattr(u, "resume"),
                "connected_accounts_count": u.gmail_accounts.count(),
                "connected_accounts": [
                    {"id": acc.id, "email": acc.email_address, "is_active": acc.is_active}
                    for acc in u.gmail_accounts.all()
                ],
            })

        return Response({
            "stats": {
                "total_users": total_users,
                "normal_users": normal_users,
                "admin_users": admin_users,
                "total_connected_accounts": total_accounts,
                "active_connected_accounts": active_accounts,
            },
            "users": users_list,
        })


class GeminiGenerateSingleView(APIView):
    """
    Uses Google Gemini to analyze user's resume and a specific job posting
    to generate tailored application email Subject & Body.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_resume = getattr(request.user, "resume", None)
        if (not user_resume or not user_resume.extracted_text.strip()) and getattr(request.user, "is_admin", False):
            from accounts.models import UserResume
            user_id = request.data.get("user_id") or request.query_params.get("user_id")
            if user_id:
                user_resume = UserResume.objects.filter(user_id=user_id).first()
            if not user_resume:
                user_resume = UserResume.objects.exclude(extracted_text="").first()
        if not user_resume or not user_resume.extracted_text.strip():
            return Response(
                {"error": "Please upload your resume first before using AI generation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        recipient_email = request.data.get("recipient_email", "").strip()
        job_post = request.data.get("job_post", "").strip()
        api_key = request.data.get("gemini_api_key", "").strip() or None

        if not job_post:
            return Response(
                {"error": "Please provide the job vacancy or job posting details."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sender_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email.split("@")[0]

        try:
            generated = gemini_service.generate_single_job_application(
                resume_text=user_resume.extracted_text,
                recipient_email=recipient_email,
                job_post=job_post,
                sender_name=sender_name,
                api_key=api_key,
            )
            return Response({
                "subject": generated["subject"],
                "body": generated["body"],
                "resume_name": user_resume.original_filename,
                "resume_attached": True,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class GeminiGenerateBulkView(APIView):
    """
    Uses Google Gemini to analyze user's resume and target job role
    to generate professional cold outreach email Subject & Body for a list of emails.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_resume = getattr(request.user, "resume", None)
        if (not user_resume or not user_resume.extracted_text.strip()) and getattr(request.user, "is_admin", False):
            from accounts.models import UserResume
            user_id = request.data.get("user_id") or request.query_params.get("user_id")
            if user_id:
                user_resume = UserResume.objects.filter(user_id=user_id).first()
            if not user_resume:
                user_resume = UserResume.objects.exclude(extracted_text="").first()
        if not user_resume or not user_resume.extracted_text.strip():
            return Response(
                {"error": "Please upload your resume first before using AI outreach generation."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_job_role = request.data.get("target_job_role", "").strip()
        notes = request.data.get("notes", "").strip()
        api_key = request.data.get("gemini_api_key", "").strip() or None

        if not target_job_role:
            return Response(
                {"error": "Please specify which kind of job / role you are searching for."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sender_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email.split("@")[0]

        try:
            generated = gemini_service.generate_bulk_cold_outreach(
                resume_text=user_resume.extracted_text,
                target_job_role=target_job_role,
                additional_notes=notes,
                sender_name=sender_name,
                api_key=api_key,
            )
            return Response({
                "subject": generated["subject"],
                "body": generated["body"],
                "resume_name": user_resume.original_filename,
                "resume_attached": True,
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

