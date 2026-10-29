import io
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from django.conf import settings
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)

# Scopes needed to upload, share, and manage images in Google Drive
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]


def get_drive_credentials_path() -> Optional[str]:
    """Resolve absolute path to Google Service Account credentials JSON."""
    raw_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")
    if not raw_path:
        # Check standard default location in config directory
        candidate = Path(settings.BASE_DIR) / "config" / "lucifer-43ef2-6fcdd9012109.json"
        if candidate.exists():
            return str(candidate)
        return None

    cleaned_path = raw_path.strip("\"'")
    p = Path(cleaned_path)
    if not p.is_absolute():
        p = Path(settings.BASE_DIR) / p
    return str(p) if p.exists() else None


def get_drive_folder_id() -> Optional[str]:
    """Retrieve target Google Drive parent folder ID from environment."""
    raw_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
    return raw_id.strip("\"'") if raw_id else None


def get_drive_service():
    """Build and return an authenticated Google Drive v3 service instance."""
    creds_path = get_drive_credentials_path()
    if not creds_path:
        raise ValueError(
            "Google Drive credentials file not found. Ensure GOOGLE_APPLICATION_CREDENTIALS is set in .env."
        )

    credentials = service_account.Credentials.from_service_account_file(
        creds_path,
        scopes=DRIVE_SCOPES,
    )
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def upload_image_to_drive(
    file_bytes: bytes,
    original_filename: str,
    mime_type: str = "image/jpeg",
    folder_id: Optional[str] = None,
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Upload image bytes to Google Drive, grant read permission, and return links & metadata.
    If the Google Drive folder is on a personal Gmail account and triggers Google's
    'storageQuotaExceeded' for Service Accounts, safely stores in media storage fallback.

    Returns:
        dict: {
            "storage_provider": "google_drive" | "local_fallback",
            "drive_file_id": str,
            "image_url": str,         # Direct embed/view link
            "web_view_link": str,     # Google Drive web preview
            "web_content_link": str,  # Direct download link
            "thumbnail_link": str,
            "filename": str,
            "mime_type": str,
            "file_size": int,
        }
    """
    service = get_drive_service()
    target_folder_id = folder_id or get_drive_folder_id()

    file_metadata: Dict[str, Any] = {
        "name": original_filename,
    }
    if target_folder_id:
        file_metadata["parents"] = [target_folder_id]

    media = MediaIoBaseUpload(
        io.BytesIO(file_bytes),
        mimetype=mime_type or "image/jpeg",
        resumable=True,
    )

    try:
        # 1. Create file in Google Drive (supportsAllDrives=True for Shared Drives)
        drive_file = (
            service.files()
            .create(
                body=file_metadata,
                media_body=media,
                fields="id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink",
                supportsAllDrives=True,
            )
            .execute()
        )

        file_id = drive_file.get("id")
        if not file_id:
            raise RuntimeError("Failed to obtain file ID from Google Drive upload response.")

        # 2. Grant public read permission ('anyone' with 'reader' role)
        try:
            service.permissions().create(
                fileId=file_id,
                body={"type": "anyone", "role": "reader"},
                fields="id",
                supportsAllDrives=True,
            ).execute()
        except Exception as perm_err:
            logger.warning(f"Failed to set public reader permission on Drive file {file_id}: {perm_err}")

        # 3. Construct permanent direct view image URL
        direct_image_url = f"https://drive.google.com/uc?export=view&id={file_id}"

        return {
            "storage_provider": "google_drive",
            "drive_file_id": file_id,
            "image_url": direct_image_url,
            "web_view_link": drive_file.get("webViewLink") or direct_image_url,
            "web_content_link": drive_file.get("webContentLink") or "",
            "thumbnail_link": drive_file.get("thumbnailLink") or "",
            "filename": drive_file.get("name") or original_filename,
            "mime_type": drive_file.get("mimeType") or mime_type,
            "file_size": int(drive_file.get("size") or len(file_bytes)),
        }
    except Exception as e:
        error_str = str(e)
        # Google Service Accounts have 0 bytes storage quota in personal Gmail folders
        if "storageQuotaExceeded" in error_str or "Service Accounts do not have storage quota" in error_str:
            logger.warning(
                "Google Drive upload rejected: Service Accounts have 0 MB quota in personal Gmail folders. "
                "Defaulting to local media storage fallback."
            )
            return save_image_to_local_media(
                file_bytes=file_bytes,
                original_filename=original_filename,
                mime_type=mime_type,
                user_id=user_id,
            )
        raise e


def save_image_to_local_media(
    file_bytes: bytes,
    original_filename: str,
    mime_type: str = "image/jpeg",
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Fallback storage for personal drives where Service Account has 0 quota."""
    import uuid

    media_dir = Path(settings.MEDIA_ROOT) / "user_images"
    media_dir.mkdir(parents=True, exist_ok=True)

    safe_id = str(uuid.uuid4())[:8]
    clean_name = Path(original_filename).name
    saved_filename = f"{safe_id}_{clean_name}"
    file_path = media_dir / saved_filename

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    relative_url = f"/media/user_images/{saved_filename}"
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
    full_url = f"{backend_url}{relative_url}"

    return {
        "storage_provider": "local_fallback",
        "drive_file_id": f"local_{safe_id}",
        "image_url": full_url,
        "web_view_link": full_url,
        "web_content_link": full_url,
        "thumbnail_link": full_url,
        "filename": original_filename,
        "mime_type": mime_type,
        "file_size": len(file_bytes),
        "note": "Stored locally because Service Accounts have 0 MB quota in personal Gmail folders. For direct Google Drive storage, use a Google Workspace Shared Drive.",
    }


def delete_image_from_drive(file_id: str) -> bool:
    """Delete an image file from Google Drive (or local storage fallback)."""
    if not file_id:
        return False

    if file_id.startswith("local_"):
        # Local media fallback cleanup
        try:
            media_dir = Path(settings.MEDIA_ROOT) / "user_images"
            safe_id = file_id.replace("local_", "")
            for f in media_dir.glob(f"{safe_id}_*"):
                if f.is_file():
                    f.unlink()
            return True
        except Exception as e:
            logger.error(f"Failed to delete local fallback image {file_id}: {e}")
            return False

    try:
        service = get_drive_service()
        service.files().delete(fileId=file_id, supportsAllDrives=True).execute()
        return True
    except Exception as e:
        logger.error(f"Failed to delete file {file_id} from Google Drive: {e}")
        return False
