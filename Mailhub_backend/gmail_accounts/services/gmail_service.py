import base64
from datetime import timezone as dt_timezone
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import mimetypes
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.utils import timezone
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from ..models import GmailAccount
from .message_parser import parse_full_message, parse_message_summary


def get_gmail_service(account: GmailAccount):
    """
    Constructs an authenticated Google Gmail API service client.
    Automatically refreshes expired access tokens and persists updated credentials.
    """
    access_token = account.get_decrypted_access_token()
    refresh_token = account.get_decrypted_refresh_token()

    if not access_token and not refresh_token:
        raise ValueError(
            f"Gmail account {account.email_address} has no valid credentials. Please reconnect this account."
        )

    scopes = account.scopes.split() if account.scopes else [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send",
        "https://mail.google.com/",
    ]

    # Convert aware expiry to naive UTC for Google Credentials if present
    expiry_naive = None
    if account.token_expiry:
        expiry_naive = account.token_expiry.astimezone(dt_timezone.utc).replace(tzinfo=None)

    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token or None,
        expiry=expiry_naive,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=scopes,
    )

    # Only refresh if the token is actually expired AND a refresh token is present
    if (credentials.expired or account.is_token_expired):
        if refresh_token:
            try:
                credentials.refresh(Request())
                new_expiry = credentials.expiry
                if new_expiry and timezone.is_naive(new_expiry):
                    new_expiry = timezone.make_aware(new_expiry, dt_timezone.utc)

                account.set_tokens(
                    access_token=credentials.token,
                    refresh_token=credentials.refresh_token or refresh_token,
                    expiry=new_expiry,
                )
                account.save(update_fields=["access_token", "refresh_token", "token_expiry", "updated_at"])
            except Exception as e:
                account.is_active = False
                account.save(update_fields=["is_active", "updated_at"])
                raise ValueError(
                    f"Google credentials for {account.email_address} have expired or been revoked. Please reconnect this account."
                )
        elif not access_token:
            raise ValueError(
                f"Access token for {account.email_address} has expired and no refresh token is stored. Please reconnect your account."
            )

    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def get_account_profile(account: GmailAccount) -> Dict[str, Any]:
    """Retrieves basic account statistics from Gmail API."""
    service = get_gmail_service(account)
    profile = service.users().getProfile(userId="me").execute()
    return {
        "email_address": profile.get("emailAddress"),
        "messages_total": profile.get("messagesTotal"),
        "threads_total": profile.get("threadsTotal"),
        "history_id": profile.get("historyId"),
    }


def list_emails(
    account: GmailAccount,
    folder: str = "inbox",
    query: str = "",
    page_token: Optional[str] = None,
    max_results: int = 20,
) -> Dict[str, Any]:
    """
    Lists messages from a specific folder or with a search query.
    Supports folders: inbox, sent, drafts, trash, spam, starred, important, all.
    """
    service = get_gmail_service(account)

    folder_map = {
        "inbox": ["INBOX"],
        "sent": ["SENT"],
        "drafts": ["DRAFT"],
        "trash": ["TRASH"],
        "spam": ["SPAM"],
        "starred": ["STARRED"],
        "important": ["IMPORTANT"],
        "all": None,
    }

    label_ids = folder_map.get(folder.lower(), ["INBOX"])

    kwargs: Dict[str, Any] = {
        "userId": "me",
        "maxResults": min(max_results, 50),
    }

    if label_ids is not None:
        kwargs["labelIds"] = label_ids
    if query:
        kwargs["q"] = query
    if page_token:
        kwargs["pageToken"] = page_token

    response = service.users().messages().list(**kwargs).execute()
    messages_raw = response.get("messages", [])
    next_page_token = response.get("nextPageToken")
    result_size_estimate = response.get("resultSizeEstimate", 0)

    # Retrieve lightweight metadata for each message
    results = []
    for msg in messages_raw:
        try:
            details = (
                service.users()
                .messages()
                .get(
                    userId="me",
                    id=msg["id"],
                    format="metadata",
                    metadataHeaders=["From", "To", "Subject", "Date"],
                )
                .execute()
            )
            parsed = parse_message_summary(details)
            results.append(parsed)
        except HttpError:
            continue

    return {
        "messages": results,
        "next_page_token": next_page_token,
        "result_size_estimate": result_size_estimate,
        "folder": folder,
    }


def get_email_detail(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Retrieves full message details, parsed body, and attachment metadata."""
    service = get_gmail_service(account)
    message_data = (
        service.users()
        .messages()
        .get(userId="me", id=message_id, format="full")
        .execute()
    )
    return parse_full_message(message_data)


def download_attachment(
    account: GmailAccount, message_id: str, attachment_id: str
) -> bytes:
    """Downloads raw binary content for an email attachment."""
    service = get_gmail_service(account)
    attachment_data = (
        service.users()
        .messages()
        .attachments()
        .get(userId="me", messageId=message_id, id=attachment_id)
        .execute()
    )
    raw_data = attachment_data.get("data", "")
    padded_data = raw_data + "=" * (-len(raw_data) % 4)
    return base64.urlsafe_b64decode(padded_data)


def send_email(
    account: GmailAccount,
    to: List[str],
    subject: str,
    body_text: str = "",
    body_html: str = "",
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
    attachments: Optional[List[Any]] = None,
    thread_id: Optional[str] = None,
    in_reply_to: Optional[str] = None,
    references: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Sends an email through Gmail API with support for:
    - Plain text and HTML bodies
    - CC and BCC
    - File attachments
    - Threading headers for replies
    """
    service = get_gmail_service(account)

    # Construct MIME message
    if attachments:
        message = MIMEMultipart("mixed")
        body_part = MIMEMultipart("alternative")
        if body_text:
            body_part.attach(MIMEText(body_text, "plain", "utf-8"))
        if body_html:
            body_part.attach(MIMEText(body_html, "html", "utf-8"))
        message.attach(body_part)

        # Attach uploaded files
        for uploaded_file in attachments:
            file_name = getattr(uploaded_file, "name", "attachment")
            content_type = getattr(uploaded_file, "content_type", None)
            if not content_type:
                content_type, _ = mimetypes.guess_type(file_name)
            content_type = content_type or "application/octet-stream"

            file_content = uploaded_file.read() if hasattr(uploaded_file, "read") else uploaded_file
            part = MIMEApplication(file_content)
            part.add_header("Content-Disposition", f'attachment; filename="{file_name}"')
            part.add_header("Content-Type", content_type)
            message.attach(part)
    elif body_html and body_text:
        message = MIMEMultipart("alternative")
        message.attach(MIMEText(body_text, "plain", "utf-8"))
        message.attach(MIMEText(body_html, "html", "utf-8"))
    elif body_html:
        message = MIMEText(body_html, "html", "utf-8")
    else:
        message = MIMEText(body_text or "", "plain", "utf-8")

    # Headers
    message["From"] = account.email_address
    message["To"] = ", ".join(to) if isinstance(to, list) else to
    message["Subject"] = subject

    if cc:
        message["Cc"] = ", ".join(cc) if isinstance(cc, list) else cc
    if bcc:
        message["Bcc"] = ", ".join(bcc) if isinstance(bcc, list) else bcc

    if in_reply_to:
        message["In-Reply-To"] = in_reply_to
    if references:
        message["References"] = references

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    body: Dict[str, Any] = {"raw": raw_message}
    if thread_id:
        body["threadId"] = thread_id

    sent_message = service.users().messages().send(userId="me", body=body).execute()
    return sent_message


def reply_email(
    account: GmailAccount,
    message_id: str,
    body_text: str = "",
    body_html: str = "",
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
    attachments: Optional[List[Any]] = None,
    reply_all: bool = False,
) -> Dict[str, Any]:
    """Replies to an existing message maintaining thread ID and headers."""
    orig = get_email_detail(account, message_id)

    orig_from = orig.get("from", "")
    orig_subject = orig.get("subject", "")
    msg_id_header = orig.get("message_id_header", "")
    thread_id = orig.get("thread_id")

    # Clean reply subject
    reply_subject = orig_subject if orig_subject.lower().startswith("re:") else f"Re: {orig_subject}"

    # Determine recipient
    to_list = [orig_from]
    cc_list = list(cc or [])

    if reply_all:
        orig_to = [addr.strip() for addr in orig.get("to", "").split(",") if addr.strip()]
        for addr in orig_to:
            if account.email_address.lower() not in addr.lower() and addr not in to_list:
                cc_list.append(addr)

    return send_email(
        account=account,
        to=to_list,
        subject=reply_subject,
        body_text=body_text,
        body_html=body_html,
        cc=cc_list if cc_list else None,
        bcc=bcc,
        attachments=attachments,
        thread_id=thread_id,
        in_reply_to=msg_id_header,
        references=msg_id_header,
    )


def forward_email(
    account: GmailAccount,
    message_id: str,
    to: List[str],
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
    body_text: str = "",
    body_html: str = "",
    attachments: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """Forwards an existing email with forward header formatting."""
    orig = get_email_detail(account, message_id)
    orig_subject = orig.get("subject", "")
    forward_subject = orig_subject if orig_subject.lower().startswith("fwd:") else f"Fwd: {orig_subject}"

    header_block = (
        f"\n\n---------- Forwarded message ---------\n"
        f"From: {orig.get('from', '')}\n"
        f"Date: {orig.get('date', '')}\n"
        f"Subject: {orig_subject}\n"
        f"To: {orig.get('to', '')}\n\n"
    )

    combined_text = (body_text or "") + header_block + (orig.get("body_text", ""))
    combined_html = ""
    if body_html or orig.get("body_html"):
        header_block_html = (
            f"<br><br><div>---------- Forwarded message ---------<br>"
            f"<b>From:</b> {orig.get('from', '')}<br>"
            f"<b>Date:</b> {orig.get('date', '')}<br>"
            f"<b>Subject:</b> {orig_subject}<br>"
            f"<b>To:</b> {orig.get('to', '')}</div><br>"
        )
        combined_html = (body_html or "") + header_block_html + (orig.get("body_html", ""))

    return send_email(
        account=account,
        to=to,
        subject=forward_subject,
        body_text=combined_text,
        body_html=combined_html,
        cc=cc,
        bcc=bcc,
        attachments=attachments,
    )


def trash_email(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Moves an email to Trash."""
    service = get_gmail_service(account)
    return service.users().messages().trash(userId="me", id=message_id).execute()


def untrash_email(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Restores an email from Trash."""
    service = get_gmail_service(account)
    return service.users().messages().untrash(userId="me", id=message_id).execute()


def permanently_delete_email(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Permanently deletes an individual email from Gmail."""
    service = get_gmail_service(account)
    service.users().messages().delete(userId="me", id=message_id).execute()
    return {"message": "Message permanently deleted."}


def empty_trash(account: GmailAccount) -> Dict[str, Any]:
    """Permanently deletes all messages currently in the Trash folder."""
    service = get_gmail_service(account)
    # Fetch all trashed message IDs
    response = service.users().messages().list(userId="me", labelIds=["TRASH"], maxResults=500).execute()
    messages = response.get("messages", [])

    deleted_count = 0
    if messages:
        # Use batchDelete if possible, or individual delete
        ids = [m["id"] for m in messages]
        try:
            service.users().messages().batchDelete(userId="me", body={"ids": ids}).execute()
            deleted_count = len(ids)
        except Exception:
            for m in messages:
                try:
                    service.users().messages().delete(userId="me", id=m["id"]).execute()
                    deleted_count += 1
                except Exception:
                    pass

    return {
        "message": f"Trash emptied successfully. Deleted {deleted_count} messages.",
        "deleted_count": deleted_count,
    }


def modify_labels(
    account: GmailAccount,
    message_id: str,
    add_labels: Optional[List[str]] = None,
    remove_labels: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Adds or removes Gmail labels from a message."""
    service = get_gmail_service(account)
    body: Dict[str, Any] = {
        "addLabelIds": add_labels or [],
        "removeLabelIds": remove_labels or [],
    }
    return (
        service.users()
        .messages()
        .modify(userId="me", id=message_id, body=body)
        .execute()
    )


def mark_as_read(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Marks an email as read by removing the UNREAD label."""
    return modify_labels(account, message_id, remove_labels=["UNREAD"])


def mark_as_unread(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Marks an email as unread by adding the UNREAD label."""
    return modify_labels(account, message_id, add_labels=["UNREAD"])


def star_email(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Stars an email by adding the STARRED label."""
    return modify_labels(account, message_id, add_labels=["STARRED"])


def unstar_email(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Unstars an email by removing the STARRED label."""
    return modify_labels(account, message_id, remove_labels=["STARRED"])


def archive_email(account: GmailAccount, message_id: str) -> Dict[str, Any]:
    """Archives an email by removing the INBOX label."""
    return modify_labels(account, message_id, remove_labels=["INBOX"])
