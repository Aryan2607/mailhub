import base64
from typing import Any, Dict, List, Tuple


def decode_base64_url(encoded_data: str) -> str:
    """Decodes a URL-safe base64 string to a unicode string."""
    if not encoded_data:
        return ""
    try:
        # Normalize padding
        padded_data = encoded_data + "=" * (-len(encoded_data) % 4)
        raw_bytes = base64.urlsafe_b64decode(padded_data)
        # Attempt UTF-8, then fallback to ISO-8859-1
        try:
            return raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return raw_bytes.decode("iso-8859-1", errors="replace")
    except Exception:
        return ""


def extract_headers(headers_list: List[Dict[str, str]]) -> Dict[str, str]:
    """Converts Gmail's list of header dicts [{'name': '...', 'value': '...'}] into a dictionary."""
    headers_dict = {}
    if not headers_list:
        return headers_dict

    for h in headers_list:
        name = h.get("name", "").strip()
        value = h.get("value", "").strip()
        # Canonicalize header names
        headers_dict[name.lower()] = value
        # Also store original casing for standard lookups
        headers_dict[name] = value

    return headers_dict


def parse_body_and_attachments(
    payload: Dict[str, Any]
) -> Tuple[str, str, List[Dict[str, Any]]]:
    """
    Recursively extracts plain text, HTML body, and attachments from a Gmail message payload.
    Returns: (body_text, body_html, attachments_list)
    """
    body_text = ""
    body_html = ""
    attachments = []

    def _walk_parts(part: Dict[str, Any]):
        nonlocal body_text, body_html, attachments

        mime_type = part.get("mimeType", "").lower()
        filename = part.get("filename", "")
        body_data = part.get("body", {})
        attachment_id = body_data.get("attachmentId")
        size = body_data.get("size", 0)

        # If it has an attachmentId or non-empty filename, it's an attachment
        if filename and (attachment_id or size > 0):
            attachments.append({
                "attachment_id": attachment_id or "",
                "filename": filename,
                "mime_type": mime_type,
                "size": size,
            })
        elif mime_type == "text/plain":
            data = body_data.get("data", "")
            if data and not body_text:
                body_text = decode_base64_url(data)
        elif mime_type == "text/html":
            data = body_data.get("data", "")
            if data and not body_html:
                body_html = decode_base64_url(data)

        # Recursively process child parts
        subparts = part.get("parts", [])
        for sub in subparts:
            _walk_parts(sub)

    _walk_parts(payload)
    return body_text, body_html, attachments


def parse_full_message(message_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses full message payload from Gmail API into a clean, structured dictionary.
    """
    payload = message_data.get("payload", {})
    headers = extract_headers(payload.get("headers", []))
    body_text, body_html, attachments = parse_body_and_attachments(payload)

    label_ids = message_data.get("labelIds", [])
    is_read = "UNREAD" not in label_ids
    is_starred = "STARRED" in label_ids
    is_trashed = "TRASH" in label_ids
    is_draft = "DRAFT" in label_ids
    is_sent = "SENT" in label_ids
    is_spam = "SPAM" in label_ids

    return {
        "id": message_data.get("id"),
        "thread_id": message_data.get("threadId"),
        "snippet": message_data.get("snippet", ""),
        "subject": headers.get("Subject", headers.get("subject", "(No Subject)")),
        "from": headers.get("From", headers.get("from", "")),
        "to": headers.get("To", headers.get("to", "")),
        "cc": headers.get("Cc", headers.get("cc", "")),
        "bcc": headers.get("Bcc", headers.get("bcc", "")),
        "date": headers.get("Date", headers.get("date", "")),
        "message_id_header": headers.get("Message-ID", headers.get("message-id", "")),
        "in_reply_to": headers.get("In-Reply-To", headers.get("in-reply-to", "")),
        "references": headers.get("References", headers.get("references", "")),
        "labels": label_ids,
        "is_read": is_read,
        "is_starred": is_starred,
        "is_trashed": is_trashed,
        "is_draft": is_draft,
        "is_sent": is_sent,
        "is_spam": is_spam,
        "body_text": body_text,
        "body_html": body_html,
        "attachments": attachments,
        "internal_date": message_data.get("internalDate"),
    }


def parse_message_summary(message_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses a metadata-only message into a lightweight summary for folder lists.
    """
    payload = message_data.get("payload", {})
    headers = extract_headers(payload.get("headers", []))
    label_ids = message_data.get("labelIds", [])

    return {
        "id": message_data.get("id"),
        "thread_id": message_data.get("threadId"),
        "snippet": message_data.get("snippet", ""),
        "subject": headers.get("Subject", headers.get("subject", "(No Subject)")),
        "from": headers.get("From", headers.get("from", "")),
        "to": headers.get("To", headers.get("to", "")),
        "date": headers.get("Date", headers.get("date", "")),
        "labels": label_ids,
        "is_read": "UNREAD" not in label_ids,
        "is_starred": "STARRED" in label_ids,
        "is_trashed": "TRASH" in label_ids,
        "internal_date": message_data.get("internalDate"),
    }
