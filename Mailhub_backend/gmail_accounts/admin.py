from django.contrib import admin
from .models import EmailCache, GmailAccount


@admin.register(GmailAccount)
class GmailAccountAdmin(admin.ModelAdmin):
    list_display = ("email_address", "user", "is_active", "token_expiry", "created_at")
    list_filter = ("is_active", "created_at")
    search_fields = ("email_address", "user__email", "google_account_id")
    readonly_fields = ("created_at", "updated_at", "access_token", "refresh_token")

    def has_change_permission(self, request, obj=None):
        return True


@admin.register(EmailCache)
class EmailCacheAdmin(admin.ModelAdmin):
    list_display = ("subject", "sender", "gmail_account", "is_read", "is_starred", "is_trashed", "received_at")
    list_filter = ("is_read", "is_starred", "is_trashed")
    search_fields = ("subject", "sender", "recipient", "gmail_message_id")
