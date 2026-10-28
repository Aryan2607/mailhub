from datetime import timezone as dt_timezone
import logging
import time
from typing import Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from django.conf import settings
from django.core import signing
from django.utils import timezone
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from accounts.models import User
from ..models import GmailAccount
from .crypto_service import encrypt_token

logger = logging.getLogger(__name__)

GMAIL_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://mail.google.com/",
]

STATE_SALT = "mailhub.gmail.oauth.state"


def get_client_config() -> dict:
    """Builds client configuration dictionary for Google OAuth Flow."""
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", "")
    client_secret = getattr(settings, "GOOGLE_CLIENT_SECRET", "")
    redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", "")

    if not client_id or not client_secret:
        raise ValueError(
            "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in environment (.env)"
        )

    return {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }


def create_oauth_flow(state: Optional[str] = None) -> Flow:
    """Creates a configured Google OAuth Flow instance."""
    client_config = get_client_config()
    flow = Flow.from_client_config(
        client_config,
        scopes=GMAIL_SCOPES,
        state=state,
    )
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def generate_authorization_url(user_id: int) -> Tuple[str, str]:
    """
    Generates a Google authorization URL with PKCE and a cryptographically
    signed state token containing user_id and code_verifier.
    """
    flow = create_oauth_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # Ensures Google returns a refresh token
    )

    code_verifier = getattr(flow, "code_verifier", None)

    # Encode user_id and PKCE code_verifier into signed state
    state_payload = {
        "user_id": user_id,
        "code_verifier": code_verifier,
        "created_at": time.time(),
    }
    state_token = signing.dumps(state_payload, salt=STATE_SALT)

    # Inject the signed state into the authorization URL query params
    parsed = urlparse(auth_url)
    qs = parse_qs(parsed.query)
    qs["state"] = [state_token]
    new_query = urlencode(qs, doseq=True)
    final_auth_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment,
    ))

    return final_auth_url, state_token


def verify_state_token(state_token: str, max_age_seconds: int = 1800) -> Tuple[int, Optional[str]]:
    """
    Verifies the signed state token and returns (user_id, code_verifier).
    Raises signing.BadSignature or signing.SignatureExpired on invalid tokens.
    """
    data = signing.loads(state_token, salt=STATE_SALT, max_age=max_age_seconds)
    user_id = data.get("user_id")
    code_verifier = data.get("code_verifier")
    if not user_id:
        raise ValueError("Invalid state payload: user_id missing.")
    return user_id, code_verifier


def process_oauth_callback(code: str, state_token: str) -> GmailAccount:
    """
    Exchanges the OAuth authorization code for Google credentials,
    passing the PKCE code_verifier, and securely stores the encrypted tokens.
    """
    user_id, code_verifier = verify_state_token(state_token)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        raise ValueError(f"User with id {user_id} does not exist.")

    flow = create_oauth_flow(state=state_token)
    if code_verifier:
        flow.code_verifier = code_verifier

    # Exchange code for credentials with Google
    token_dict = flow.fetch_token(code=code)
    print("token_dict:", token_dict)
    logger.info(f"token dict: {token_dict}")
    credentials = flow.credentials

    access_token = getattr(credentials, "token", None) or (token_dict.get("access_token") if isinstance(token_dict, dict) else None)
    refresh_token = getattr(credentials, "refresh_token", None) or (token_dict.get("refresh_token") if isinstance(token_dict, dict) else None)

    if not access_token:
        raise ValueError("Failed to obtain access token from Google OAuth response.")

    # Use Gmail profile API to get verified email address and ID
    service = build("gmail", "v1", credentials=credentials, cache_discovery=False)
    profile = service.users().getProfile(userId="me").execute()
    email_address = profile.get("emailAddress", "").strip().lower()
    google_account_id = profile.get("historyId", "")

    if not email_address:
        # Fallback to userinfo
        oauth2_service = build("oauth2", "v2", credentials=credentials, cache_discovery=False)
        user_info = oauth2_service.userinfo().get().execute()
        email_address = user_info.get("email", "").strip().lower()
        google_account_id = user_info.get("id", "")

    if not email_address:
        raise ValueError("Failed to retrieve email address for the authorized Google account.")

    # Check if an existing account exists for this user and email
    existing_account = GmailAccount.objects.filter(user=user, email_address=email_address).first()

    # If Google did not return a new refresh token on reconnect, preserve existing
    if not refresh_token and existing_account and existing_account.refresh_token:
        refresh_token = existing_account.get_decrypted_refresh_token()

    # Calculate token expiry safely
    expiry = getattr(credentials, "expiry", None)
    if not expiry and isinstance(token_dict, dict) and "expires_in" in token_dict:
        expiry = timezone.now() + timezone.timedelta(seconds=int(token_dict["expires_in"]))
    elif expiry and timezone.is_naive(expiry):
        expiry = timezone.make_aware(expiry, dt_timezone.utc)
    elif not expiry:
        expiry = timezone.now() + timezone.timedelta(seconds=3600)

    scopes_str = " ".join(credentials.scopes or GMAIL_SCOPES)

    # Pre-encrypt tokens before saving to database
    encrypted_access = encrypt_token(access_token)
    encrypted_refresh = encrypt_token(refresh_token) if refresh_token else (
        existing_account.refresh_token if (existing_account and existing_account.refresh_token) else ""
    )

    account, _ = GmailAccount.objects.update_or_create(
        user=user,
        email_address=email_address,
        defaults={
            "google_account_id": google_account_id or (existing_account.google_account_id if existing_account else ""),
            "access_token": encrypted_access,
            "refresh_token": encrypted_refresh,
            "token_expiry": expiry,
            "scopes": scopes_str,
            "is_active": True,
        },
    )

    logger.info(
        f"GmailAccount saved successfully for {email_address} (ID: {account.id}, has_refresh: {bool(encrypted_refresh)})"
    )
    return account
