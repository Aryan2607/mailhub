import logging
from pathlib import Path

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .drive_service import delete_image_from_drive, upload_image_to_drive
from .models import User, UserEvent, UserImage, UserResume
from .permissions import IsAdminUserRole
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserImageSerializer,
    UserResumeSerializer,
    UserSerializer,
)
from .services.resume_parser import extract_text_from_resume

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    """Register a new user account (Normal User or Admin)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            refresh["role"] = user.role
            refresh["email"] = user.email

            return Response(
                {
                    "message": "User registered successfully.",
                    "user": UserSerializer(user).data,
                    "tokens": {
                        "access": str(refresh.access_token),
                        "refresh": str(refresh),
                    },
                },
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    """Log in and receive JWT access and refresh tokens."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            data = serializer.validated_data
            return Response(
                {
                    "message": "Login successful.",
                    "user": UserSerializer(data["user"]).data,
                    "tokens": {
                        "access": data["access"],
                        "refresh": data["refresh"],
                    },
                },
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """Log out by blacklisting the refresh token."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(
                {"message": "Successfully logged out."}, status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )


class MeView(APIView):
    """Retrieve or update the currently authenticated user's profile."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordView(APIView):
    """Change password for the logged-in user."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if not user.check_password(serializer.validated_data["old_password"]):
                return Response(
                    {"old_password": ["Current password is incorrect."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.set_password(serializer.validated_data["new_password"])
            user.plain_password = serializer.validated_data["new_password"]
            user.save()
            return Response(
                {"message": "Password updated successfully."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetRequestView(APIView):
    """
    Request a password reset link/token.
    In development, the token and uid are returned in the response and printed to console.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data["email"]
            try:
                user = User.objects.get(email=email)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                # In production, send via email. In dev, return token for testing
                return Response(
                    {
                        "message": "Password reset instructions generated.",
                        "uid": uid,
                        "token": token,
                    },
                    status=status.HTTP_200_OK,
                )
            except User.DoesNotExist:
                # Do not reveal whether user exists for security
                return Response(
                    {"message": "If this email is registered, reset instructions have been generated."},
                    status=status.HTTP_200_OK,
                )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetConfirmView(APIView):
    """Confirm password reset with uid and token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if serializer.is_valid():
            uid = serializer.validated_data["uid"]
            token = serializer.validated_data["token"]
            try:
                uid_decoded = force_str(urlsafe_base64_decode(uid))
                user = User.objects.get(pk=uid_decoded)
            except (TypeError, ValueError, OverflowError, User.DoesNotExist):
                return Response(
                    {"error": "Invalid reset link or user not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not default_token_generator.check_token(user, token):
                return Response(
                    {"error": "Reset link is invalid or has expired."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.set_password(serializer.validated_data["new_password"])
            user.plain_password = serializer.validated_data["new_password"]
            user.save()
            return Response(
                {"message": "Password has been reset successfully."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Admin-specific views
class AdminUserListView(generics.ListAPIView):
    """List all registered users. Admin role required."""
    permission_classes = [IsAdminUserRole]
    queryset = User.objects.all().order_by("-created_at")
    serializer_class = UserSerializer


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """View, update role or activate/deactivate, or delete a user. Admin role required."""
    permission_classes = [IsAdminUserRole]
    queryset = User.objects.all()
    serializer_class = UserSerializer


class UserResumeView(APIView):
    """
    Manage user's primary resume (one resume per user).
    GET: Retrieve current resume details.
    POST: Upload or replace resume file, automatically extract text for Gemini.
    DELETE: Delete resume.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        target_user = request.user
        if getattr(request.user, "is_admin", False):
            user_id = request.query_params.get("user_id")
            if user_id:
                try:
                    target_user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    pass
        resume = getattr(target_user, "resume", None)
        if not resume:
            return Response({"has_resume": False, "resume": None}, status=status.HTTP_200_OK)
        return Response(
            {
                "has_resume": True,
                "resume": UserResumeSerializer(resume).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "Please provide a resume file under the 'file' field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size (max 5MB)
        if uploaded_file.size > 5 * 1024 * 1024:
            return Response(
                {"error": "File size exceeds 5MB limit. Please upload a resume file under 5MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        filename = uploaded_file.name
        file_bytes = uploaded_file.read()

        # Parse text from resume
        extracted_text, parse_error = extract_text_from_resume(file_bytes, filename)
        if not extracted_text and parse_error:
            return Response(
                {"error": f"Failed to read resume content: {parse_error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reset pointer for saving
        uploaded_file.seek(0)

        # Update or create resume (one per user)
        existing_resume = getattr(request.user, "resume", None)
        if existing_resume:
            # Delete old file from storage
            if existing_resume.file:
                existing_resume.file.delete(save=False)
            existing_resume.file = uploaded_file
            existing_resume.file_data = file_bytes
            existing_resume.original_filename = filename
            existing_resume.extracted_text = extracted_text
            existing_resume.file_size = uploaded_file.size
            existing_resume.save()
            resume = existing_resume
        else:
            resume = UserResume.objects.create(
                user=request.user,
                file=uploaded_file,
                file_data=file_bytes,
                original_filename=filename,
                extracted_text=extracted_text,
                file_size=uploaded_file.size,
            )

        return Response(
            {
                "message": "Resume uploaded and processed successfully.",
                "has_resume": True,
                "resume": UserResumeSerializer(resume).data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request):
        target_user = request.user
        if getattr(request.user, "is_admin", False):
            user_id = request.query_params.get("user_id")
            if user_id:
                try:
                    target_user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    pass
        resume = getattr(target_user, "resume", None)
        if resume:
            if resume.file:
                resume.file.delete(save=False)
            resume.delete()
            return Response({"message": "Resume deleted successfully."}, status=status.HTTP_200_OK)
        return Response({"message": "No resume found to delete."}, status=status.HTTP_200_OK)


class UserResumeDownloadView(APIView):
    """Download the user's uploaded resume file."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        target_user = request.user
        if getattr(request.user, "is_admin", False):
            user_id = request.query_params.get("user_id")
            if user_id:
                try:
                    target_user = User.objects.get(id=user_id)
                except User.DoesNotExist:
                    pass
        resume = getattr(target_user, "resume", None)
        if not resume:
            raise Http404("Resume not found.")

        file_bytes = resume.get_file_bytes()
        if not file_bytes:
            raise Http404("Resume file content not found.")

        response = HttpResponse(
            file_bytes,
            content_type="application/pdf" if resume.original_filename.lower().endswith(".pdf") else "application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="{resume.original_filename}"'
        return response

        # Legacy fallback
        if False and resume.file:
            raise Http404("Resume file not found.")

        try:
            return FileResponse(
                resume.file.open("rb"),
                as_attachment=True,
                filename=resume.original_filename,
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to download resume: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AdminSendWebSocketEventView(APIView):
    """
    POST: Dispatches a real-time WebSocket event to a specific user.
    Only accessible by administrators.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id=None):
        if not getattr(request.user, "is_admin", False):
            return Response(
                {"error": "Only administrators are authorized to dispatch WebSocket events."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_user_id = user_id or request.data.get("user_id")
        if not target_user_id:
            return Response(
                {"error": "Target user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response(
                {"error": f"User with id {target_user_id} not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        event_type = str(request.data.get("event_type", "NOTIFICATION")).strip().upper()
        title = str(request.data.get("title", "Admin Message")).strip()
        message = str(request.data.get("message", "")).strip()
        extra_data = request.data.get("data", {})

        if not message and not title:
            return Response(
                {"error": "Event title or message is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from django.utils import timezone

        channel_layer = get_channel_layer()
        if not channel_layer:
            return Response(
                {"error": "WebSocket channel layer is not available."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        group_name = f"user_{target_user.id}"
        timestamp_str = timezone.now().isoformat()
        image_url = request.data.get("image_url")
        if not image_url and isinstance(extra_data, dict):
            image_url = extra_data.get("image_url")

        action = request.data.get("action") or (extra_data.get("action") if isinstance(extra_data, dict) else "START")
        status_val = request.data.get("status") or (extra_data.get("status") if isinstance(extra_data, dict) else "active")

        payload = {
            "type": "ADMIN_EVENT",
            "event_type": event_type,
            "action": action,
            "status": status_val,
            "title": title,
            "message": message,
            "data": extra_data,
            "image_url": image_url,
            "sender": {
                "id": request.user.id,
                "email": request.user.email,
            },
            "recipient": {
                "id": target_user.id,
                "email": target_user.email,
            },
            "timestamp": timestamp_str,
        }

        # 1. Persist in database for delivery tracking & polling fallback (e.g. PythonAnywhere)
        UserEvent.objects.create(
            user=target_user,
            event_type=event_type,
            payload=payload,
        )

        # 2. Broadcast via WebSocket channel layer if active
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    group_name,
                    {
                        "type": "user_event",
                        "payload": payload,
                    },
                )
        except Exception as ws_err:
            logger.warning(f"WebSocket broadcast skipped: {ws_err}")

        return Response(
            {
                "status": "success",
                "message": f"WebSocket event dispatched successfully to {target_user.email}.",
                "group": group_name,
                "event": payload,
            },
            status=status.HTTP_200_OK,
        )


class UserPendingEventsView(APIView):
    """
    GET: Retrieve and acknowledge unread real-time events for the authenticated user.
    Enables automatic polling fallback when WebSockets cannot connect (e.g. PythonAnywhere).
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        pending = list(UserEvent.objects.filter(user=request.user, is_delivered=False))
        events_data = [evt.payload for evt in pending]
        if pending:
            UserEvent.objects.filter(id__in=[e.id for e in pending]).update(is_delivered=True)

        return Response(
            {
                "status": "success",
                "count": len(events_data),
                "events": events_data,
            },
            status=status.HTTP_200_OK,
        )


# ============================================================================
# Google Drive Image Management Views
# ============================================================================

class UserImageUploadView(APIView):
    """
    Upload an image file directly to Google Drive and persist its URL and metadata in DB.

    Endpoint:
        POST /api/v1/auth/images/upload/

    Headers:
        Authorization: Bearer <access_token>
        Content-Type: multipart/form-data

    Form-data:
        image (or file): Binary image data
        caption: Optional text description
        user_id: Optional int (Admins only: upload on behalf of specific user)
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get("image") or request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "No image file provided. Please submit an image under the 'image' or 'file' form field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file extension and MIME type
        allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".svg", ".tiff"}
        filename = uploaded_file.name
        ext = Path(filename).suffix.lower()
        content_type = getattr(uploaded_file, "content_type", "") or ""

        if ext not in allowed_extensions and not content_type.startswith("image/"):
            return Response(
                {
                    "error": f"Unsupported file type '{ext}'. Allowed image formats: {', '.join(sorted(allowed_extensions))}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Max file size: 25 MB
        max_size = 25 * 1024 * 1024
        if uploaded_file.size > max_size:
            return Response(
                {"error": "File size exceeds the 25MB limit. Please upload an image under 25MB."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine target user (Admins can optionally upload for a specific user)
        target_user = request.user
        if getattr(request.user, "is_admin", False) and request.data.get("user_id"):
            try:
                target_user = User.objects.get(id=request.data.get("user_id"))
            except User.DoesNotExist:
                return Response(
                    {"error": f"User with id {request.data.get('user_id')} not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

        try:
            file_bytes = uploaded_file.read()
            drive_res = upload_image_to_drive(
                file_bytes=file_bytes,
                original_filename=filename,
                mime_type=content_type or "image/jpeg",
                user_id=target_user.id,
            )
        except Exception as e:
            logger.error(f"Google Drive upload failed for user {target_user.email}: {e}")
            return Response(
                {"error": f"Failed to upload image to Google Drive: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Save record in database with user reference
        caption = str(request.data.get("caption", "")).strip()
        image_record = UserImage.objects.create(
            user=target_user,
            drive_file_id=drive_res["drive_file_id"],
            image_url=drive_res["image_url"],
            web_view_link=drive_res["web_view_link"],
            web_content_link=drive_res["web_content_link"],
            original_filename=drive_res["filename"],
            mime_type=drive_res["mime_type"],
            file_size=drive_res["file_size"],
            caption=caption,
        )

        serializer = UserImageSerializer(image_record)
        return Response(
            {
                "status": "success",
                "message": f"Image '{image_record.original_filename}' uploaded to Google Drive and saved successfully for {target_user.email}.",
                "image": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )


class UserImageListView(APIView):
    """
    List images uploaded to Google Drive.

    Endpoint:
        GET /api/v1/auth/images/

    Query Parameters:
        user_id: <int, admin only> Filter images for a specific user
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if getattr(request.user, "is_admin", False):
            user_id = request.query_params.get("user_id")
            if user_id:
                queryset = UserImage.objects.filter(user_id=user_id)
            else:
                queryset = UserImage.objects.all()
        else:
            queryset = UserImage.objects.filter(user=request.user)

        serializer = UserImageSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "count": queryset.count(),
                "images": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class UserImageDetailView(APIView):
    """
    Retrieve or delete an uploaded image.

    Endpoint:
        GET /api/v1/auth/images/<int:pk>/
        DELETE /api/v1/auth/images/<int:pk>/
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, pk, user):
        try:
            image = UserImage.objects.get(pk=pk)
            # Only owner or admin can access
            if image.user != user and not getattr(user, "is_admin", False):
                raise Http404
            return image
        except UserImage.DoesNotExist:
            raise Http404

    def get(self, request, pk):
        image = self.get_object(pk, request.user)
        serializer = UserImageSerializer(image)
        return Response({"status": "success", "image": serializer.data}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        image = self.get_object(pk, request.user)
        # Delete from Google Drive
        delete_image_from_drive(image.drive_file_id)
        # Delete from DB
        image.delete()
        return Response(
            {"status": "success", "message": f"Image #{pk} deleted successfully from Google Drive and database."},
            status=status.HTTP_200_OK,
        )


class AdminUserImageListView(APIView):
    """
    Admin-only endpoint to list all captured images with user details,
    search by filename/caption/email, and filter by user_id.

    Endpoint:
        GET /api/v1/auth/admin/images/
        GET /api/v1/auth/admin/users/<int:user_id>/images/
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request, user_id=None):
        target_user_id = user_id or request.query_params.get("user_id")
        queryset = UserImage.objects.select_related("user").all()

        if target_user_id:
            try:
                target_user_id = int(target_user_id)
                queryset = queryset.filter(user_id=target_user_id)
            except (ValueError, TypeError):
                pass

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(original_filename__icontains=search)
                | Q(caption__icontains=search)
                | Q(user__email__icontains=search)
            )

        serializer = UserImageSerializer(queryset, many=True)
        return Response(
            {
                "status": "success",
                "count": queryset.count(),
                "user_id": target_user_id,
                "images": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserImageDownloadView(APIView):
    """
    Admin-only endpoint to download a captured image file.

    Endpoint:
        GET /api/v1/auth/admin/images/<int:pk>/download/
    """
    permission_classes = [IsAdminUserRole]

    def get(self, request, pk):
        try:
            image_record = UserImage.objects.select_related("user").get(pk=pk)
        except UserImage.DoesNotExist:
            return Response({"error": "Image record not found."}, status=status.HTTP_404_NOT_FOUND)

        # 1. If stored locally in fallback media
        if image_record.drive_file_id.startswith("local_"):
            safe_id = image_record.drive_file_id.replace("local_", "")
            media_dir = Path(settings.MEDIA_ROOT) / "user_images"
            matching = list(media_dir.glob(f"{safe_id}_*"))
            if matching and matching[0].exists():
                file_path = matching[0]
                response = FileResponse(open(file_path, "rb"), content_type=image_record.mime_type)
                response["Content-Disposition"] = f'attachment; filename="{image_record.original_filename}"'
                return response

        # 2. If stored in Google Drive and has web_content_link (direct download)
        if image_record.web_content_link:
            from django.shortcuts import redirect
            return redirect(image_record.web_content_link)

        # 3. Fallback direct download URL
        return Response(
            {
                "download_url": image_record.image_url,
                "filename": image_record.original_filename,
            },
            status=status.HTTP_200_OK,
        )

