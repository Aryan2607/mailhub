from django.conf import settings
from django.db import models
from django.utils import timezone
from .services.crypto_service import decrypt_token, encrypt_token


class GmailAccount(models.Model):
    """
    Represents a connected Gmail account belonging to an application User.
    Tokens are always encrypted at rest using AES-CBC/Fernet.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="gmail_accounts",
    )
    email_address = models.EmailField(db_index=True)
    google_account_id = models.CharField(max_length=255, blank=True)

    # Encrypted credentials
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True, default="")
    token_expiry = models.DateTimeField(null=True, blank=True)
    scopes = models.TextField(blank=True, default="")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "email_address"],
                name="unique_user_gmail_account",
            )
        ]

    def set_tokens(self, access_token: str, refresh_token: str = None, expiry=None, scopes: str = None):
        """Encrypts and stores OAuth credentials."""
        self.access_token = encrypt_token(access_token)
        if refresh_token:
            self.refresh_token = encrypt_token(refresh_token)
        if expiry:
            self.token_expiry = expiry
        if scopes:
            self.scopes = scopes

    def get_decrypted_access_token(self):
        """Returns the decrypted access token or None."""
        if not self.access_token:
            return None
        token = decrypt_token(self.access_token)
        return token.strip() if token and token.strip() else None

    def get_decrypted_refresh_token(self):
        """Returns the decrypted refresh token or None."""
        if not self.refresh_token:
            return None
        token = decrypt_token(self.refresh_token)
        return token.strip() if token and token.strip() else None

    @property
    def is_token_expired(self) -> bool:
        """Checks if the access token has passed its expiry time."""
        if not self.token_expiry:
            return False
        # Consider expired 60 seconds before actual expiry to prevent mid-flight expiration
        return timezone.now() >= (self.token_expiry - timezone.timedelta(seconds=60))

    def __str__(self):
        return f"{self.email_address} (Owner: {self.user.email})"


class EmailCache(models.Model):
    """
    Optional metadata cache for quick search and listing.
    The Gmail API remains the source of truth for full message bodies and actions.
    """
    gmail_account = models.ForeignKey(
        GmailAccount,
        on_delete=models.CASCADE,
        related_name="cached_emails",
    )
    gmail_message_id = models.CharField(max_length=255, db_index=True)
    gmail_thread_id = models.CharField(max_length=255, blank=True, db_index=True)
    sender = models.CharField(max_length=255, blank=True)
    recipient = models.TextField(blank=True)
    subject = models.CharField(max_length=998, blank=True)
    snippet = models.TextField(blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    is_starred = models.BooleanField(default=False)
    is_trashed = models.BooleanField(default=False)
    labels = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["gmail_account", "gmail_message_id"],
                name="unique_account_message_cache",
            )
        ]

    def __str__(self):
        return f"[{self.gmail_account.email_address}] {self.subject[:50]}"
