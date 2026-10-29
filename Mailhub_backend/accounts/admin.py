from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserImage, UserResume


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("email", "role", "is_staff", "is_active", "created_at")
    list_filter = ("role", "is_staff", "is_active")
    ordering = ("-created_at",)
    search_fields = ("email", "first_name", "last_name")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        ("Role & Permissions", {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "password", "role", "first_name", "last_name"),
            },
        ),
    )


@admin.register(UserImage)
class UserImageAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "user", "file_size", "created_at", "image_url")
    list_filter = ("created_at", "mime_type")
    search_fields = ("original_filename", "user__email", "caption", "drive_file_id")
    ordering = ("-created_at",)
    readonly_fields = ("drive_file_id", "image_url", "web_view_link", "web_content_link", "created_at", "updated_at")
