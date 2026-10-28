from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, UserResume


class UserResumeSerializer(serializers.ModelSerializer):
    preview_text = serializers.SerializerMethodField()

    class Meta:
        model = UserResume
        fields = [
            "id",
            "original_filename",
            "file_size",
            "preview_text",
            "uploaded_at",
        ]
        read_only_fields = ["id", "original_filename", "file_size", "preview_text", "uploaded_at"]

    def get_preview_text(self, obj):
        if not obj.extracted_text:
            return ""
        return obj.extracted_text[:400] + ("..." if len(obj.extracted_text) > 400 else "")


class UserSerializer(serializers.ModelSerializer):
    """Public user serializer."""
    is_admin = serializers.BooleanField(read_only=True)
    connected_accounts_count = serializers.SerializerMethodField()
    has_resume = serializers.SerializerMethodField()
    resume = UserResumeSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_admin",
            "is_active",
            "connected_accounts_count",
            "has_resume",
            "resume",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_admin", "has_resume", "resume", "created_at", "updated_at"]

    def get_connected_accounts_count(self, obj):
        if hasattr(obj, "gmail_accounts"):
            return obj.gmail_accounts.count()
        return 0

    def get_has_resume(self, obj):
        return hasattr(obj, "resume") and bool(obj.resume)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password_confirm = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(
        choices=User.Role.choices, default=User.Role.USER, required=False
    )

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "role",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        role = validated_data.get("role", User.Role.USER)
        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            role=role,
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError("Invalid email or password.")
        if not user.is_active:
            raise serializers.ValidationError("This user account is inactive.")

        refresh = RefreshToken.for_user(user)
        # Add custom claims to the JWT payload
        refresh["role"] = user.role
        refresh["email"] = user.email

        return {
            "user": user,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password": "New passwords do not match."}
            )
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password_confirm = serializers.CharField(required=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password": "New passwords do not match."}
            )
        return attrs
