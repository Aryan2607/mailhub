import io
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def extract_text_from_resume(file_bytes: bytes, filename: str) -> Tuple[str, str]:
    """
    Extracts readable text from an uploaded resume file (PDF, TXT, MD, etc.).
    Returns (extracted_text, error_message).
    """
    lower_name = filename.lower()
    text = ""

    try:
        if lower_name.endswith(".pdf"):
            import pypdf
            pdf_file = io.BytesIO(file_bytes)
            reader = pypdf.PdfReader(pdf_file)
            page_texts = []
            extracted_links = []
            for i, page in enumerate(reader.pages):
                page_content = page.extract_text()
                if page_content:
                    page_texts.append(page_content.strip())
                if "/Annots" in page:
                    try:
                        for annot in page["/Annots"]:
                            obj = annot.get_object()
                            if "/A" in obj and "/URI" in obj["/A"]:
                                uri = str(obj["/A"]["/URI"]).strip()
                                if uri and uri not in extracted_links:
                                    extracted_links.append(uri)
                    except Exception:
                        pass
            text = "\n\n".join(page_texts).strip()
            if extracted_links:
                text += "\n\nExtracted Web Links & Profile URLs:\n" + "\n".join(f"- {link}" for link in extracted_links)

        elif lower_name.endswith((".txt", ".md", ".rtf", ".csv")):
            try:
                text = file_bytes.decode("utf-8").strip()
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="ignore").strip()

        elif lower_name.endswith(".docx"):
            # Try to extract xml text from docx zip if possible
            import zipfile
            import xml.etree.ElementTree as ET
            try:
                with zipfile.ZipFile(io.BytesIO(file_bytes)) as docx:
                    xml_content = docx.read("word/document.xml")
                    tree = ET.fromstring(xml_content)
                    namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
                    paragraphs = []
                    for p in tree.iterfind(".//w:p", namespaces):
                        texts = [node.text for node in p.iterfind(".//w:t", namespaces) if node.text]
                        if texts:
                            paragraphs.append("".join(texts))
                    text = "\n".join(paragraphs).strip()
            except Exception as e:
                logger.warning(f"Failed to parse docx directly: {e}")

        # Fallback if text is still empty
        if not text:
            # Try basic utf-8 / latin-1 decode
            try:
                decoded = file_bytes.decode("utf-8", errors="ignore").strip()
                # If mostly printable characters, keep it
                printable_ratio = sum(c.isprintable() for c in decoded) / max(len(decoded), 1)
                if printable_ratio > 0.8 and len(decoded) > 50:
                    text = decoded
            except Exception:
                pass

        if not text:
            return "", "Could not extract readable text from this file format. Please upload a PDF or TXT file."

        # Truncate if insanely long to protect token limits (e.g. 50,000 chars)
        if len(text) > 40000:
            text = text[:40000] + "\n...[truncated]"

        return text, ""

    except Exception as e:
        logger.error(f"Error parsing resume {filename}: {str(e)}", exc_info=True)
        return "", f"Error processing file: {str(e)}"
