from django.contrib.auth.tokens import default_token_generator
from django.http import FileResponse, Http404
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import User, UserResume
from .permissions import IsAdminUserRole
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserResumeSerializer,
    UserSerializer,
)
from .services.resume_parser import extract_text_from_resume


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
        resume = getattr(request.user, "resume", None)
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
            existing_resume.original_filename = filename
            existing_resume.extracted_text = extracted_text
            existing_resume.file_size = uploaded_file.size
            existing_resume.save()
            resume = existing_resume
        else:
            resume = UserResume.objects.create(
                user=request.user,
                file=uploaded_file,
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
        resume = getattr(request.user, "resume", None)
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
        resume = getattr(request.user, "resume", None)
        if not resume or not resume.file:
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
