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
