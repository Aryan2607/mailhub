import base64
import hashlib
from cryptography.fernet import Fernet
from django.conf import settings


def _get_fernet_instance() -> Fernet:
    """
    Returns a Fernet cipher instance.
    Uses settings.ENCRYPTION_KEY if configured.
    Falls back to a key derived deterministically from SECRET_KEY if not configured.
    """
    raw_key = getattr(settings, "ENCRYPTION_KEY", "")
    if raw_key and len(raw_key.strip()) > 0:
        try:
            return Fernet(raw_key.strip().encode())
        except Exception:
            pass

    # Deterministic fallback derivation from SECRET_KEY
    derived_bytes = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    key_b64 = base64.urlsafe_b64encode(derived_bytes)
    return Fernet(key_b64)


def encrypt_token(plain_text: str) -> str:
    """Encrypt a plain text token string."""
    if not plain_text:
        return ""
    fernet = _get_fernet_instance()
    encrypted_bytes = fernet.encrypt(plain_text.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")


def decrypt_token(encrypted_text: str) -> str:
    """Decrypt an encrypted token string."""
    if not encrypted_text:
        return ""
    fernet = _get_fernet_instance()
    try:
        decrypted_bytes = fernet.decrypt(encrypted_text.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        raise ValueError(f"Failed to decrypt token: {str(e)}")
