from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom user manager where email is the unique identifier for auth."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        extra_fields.setdefault("role", User.Role.USER)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
            user.plain_password = password
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user model supporting:
    - Normal User: connects and manages their own Gmail accounts.
    - Admin: can see all users' connected accounts, read, edit labels, trash, restore, and delete emails.
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        USER = "USER", "Normal User"

    # Make username optional, email is primary identifier
    username = models.CharField(max_length=150, blank=True, null=True)
    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.USER)
    plain_password = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Stores the password as plain text upon registration",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def save(self, *args, **kwargs):
        # Admins automatically get staff privileges for Django admin
        if self.role == self.Role.ADMIN or self.is_superuser:
            self.is_staff = True
        super().save(*args, **kwargs)

    @property
    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_staff or self.is_superuser

    def __str__(self):
        return f"{self.email} ({self.role})"


class UserResume(models.Model):
    """
    Each user can upload one primary resume for AI-powered job outreach.
    Uploading a new resume automatically updates/replaces the previous one.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="resume",
    )
    file = models.FileField(upload_to="resumes/")
    original_filename = models.CharField(max_length=255)
    extracted_text = models.TextField(blank=True, default="")
    file_size = models.PositiveIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Resume of {self.user.email} ({self.original_filename})"


class UserImage(models.Model):
    """
    Image uploaded to Google Drive linked to a specific user.
    Stores the Google Drive file ID, public direct image URL, and file metadata.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="uploaded_images",
    )
    drive_file_id = models.CharField(max_length=255, unique=True, db_index=True)
    image_url = models.URLField(max_length=1024, help_text="Direct viewable image URL")
    web_view_link = models.URLField(max_length=1024, blank=True, default="", help_text="Google Drive file viewer link")
    web_content_link = models.URLField(max_length=1024, blank=True, default="", help_text="Google Drive direct download link")
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100, default="image/jpeg")
    file_size = models.PositiveIntegerField(default=0)
    caption = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Image {self.original_filename} (User: {self.user.email})"


class UserEvent(models.Model):
    """
    Persisted real-time event dispatched to a user.
    Used for delivery tracking and seamless HTTP polling fallback
    when WebSockets are unavailable (e.g. on WSGI-only hosts like PythonAnywhere).
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="dispatched_events")
    event_type = models.CharField(max_length=64, default="NOTIFICATION")
    payload = models.JSONField(default=dict)
    is_delivered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Event {self.event_type} -> {self.user.email} (Delivered: {self.is_delivered})"

