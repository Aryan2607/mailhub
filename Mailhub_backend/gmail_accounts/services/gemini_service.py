import json
import logging
import re
from typing import Any, Dict, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-2.5-pro",
    "gemini-pro-latest",
]


def get_gemini_api_key(override_key: Optional[str] = None) -> str:
    """Returns the active Gemini API key from override or settings."""
    key = (override_key or getattr(settings, "GEMINI_API_KEY", "") or "").strip()
    if not key:
        raise ValueError(
            "Gemini API Key is not configured. Please add GEMINI_API_KEY to your backend .env file."
        )
    return key


def call_gemini_api(prompt: str, api_key: Optional[str] = None) -> str:
    """
    Calls the Google Gemini REST API with candidate models.
    Returns raw generated text response.
    """
    key = get_gemini_api_key(api_key)

    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 2048,
        }
    }

    last_error = None
    for model in GEMINI_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
            else:
                last_error = f"Gemini API returned status {resp.status_code}: {resp.text}"
                logger.warning(f"Model {model} failed: {resp.status_code} - {resp.text}")
        except Exception as e:
            last_error = str(e)
            logger.warning(f"Error calling {model}: {e}")

    raise ValueError(f"Failed to generate content with Gemini. Details: {last_error}")


def extract_json_response(raw_text: str) -> Dict[str, str]:
    """Extracts JSON object containing 'subject' and 'body' from LLM output."""
    # Look for ```json ... ``` code fence first
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if match:
        raw_text = match.group(1)
    else:
        # Look for the first outer { and last }
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            raw_text = raw_text[start : end + 1]

    try:
        data = json.loads(raw_text)
        if isinstance(data, dict) and "subject" in data and "body" in data:
            return {
                "subject": str(data.get("subject", "")).strip(),
                "body": str(data.get("body", "")).strip(),
            }
    except Exception:
        pass

    # Fallback heuristic if not valid JSON
    lines = raw_text.splitlines()
    subject = "Application / Job Inquiry"
    body_lines = []
    subject_captured = False

    for line in lines:
        if not subject_captured and line.lower().startswith(("subject:", "subject -", "**subject:**")):
            subject = line.split(":", 1)[-1].strip().strip("*").strip()
            subject_captured = True
        else:
            body_lines.append(line)

    body = "\n".join(body_lines).strip()
    return {
        "subject": subject or "Application for Job Opportunity",
        "body": body or raw_text.strip(),
    }


def generate_single_job_application(
    resume_text: str,
    recipient_email: str,
    job_post: str,
    sender_name: str = "",
    api_key: Optional[str] = None,
) -> Dict[str, str]:
    """
    Analyzes candidate's resume and a specific job posting to generate
    a tailored, high-converting job application email (subject & body).
    """
    if not resume_text or not resume_text.strip():
        raise ValueError("Resume text is empty. Please upload a valid resume.")

    if not job_post or not job_post.strip():
        raise ValueError("Please provide the job posting or vacancy details.")

    prompt = f"""You are an elite career strategist and executive copywriter.
A job seeker is sending an application email directly to a recruiter or hiring manager.

Candidate's Resume Text:
\"\"\"
{resume_text}
\"\"\"

Job Posting / Vacancy Details:
\"\"\"
{job_post}
\"\"\"

Recipient Email: {recipient_email or 'Hiring Team'}
Candidate Name: {sender_name or 'the candidate'}

Task:
1. Thoroughly analyze the candidate's skills, qualifications, work history, and achievements from the resume.
2. Cross-reference with the requirements and role responsibilities in the job posting.
3. Write a compelling, highly professional application email that:
   - Has a clear, professional subject line (e.g., "Application: [Specific Role Title] - [Candidate Name]").
   - Starts with a courteous greeting to the hiring manager or team.
   - States clearly the position being applied for.
   - Highlights 2 to 3 standout accomplishments and relevant technical/professional skills from the candidate's resume that directly match this job's needs.
   - Mentions that their complete resume is attached to the email for review.
   - Expresses enthusiasm for an interview/discussion.
   - Ends with a professional sign-off and candidate signature placeholder.

OUTPUT FORMAT REQUIREMENTS:
You MUST output ONLY a valid JSON object with EXACTLY two keys:
{{
  "subject": "The generated email subject line",
  "body": "The complete generated email body text with appropriate line breaks (\\n)"
}}
Do NOT include any other text, markdown explanations, or commentary outside of the JSON.
"""

    raw_response = call_gemini_api(prompt, api_key=api_key)
    return extract_json_response(raw_response)


def generate_bulk_cold_outreach(
    resume_text: str,
    target_job_role: str,
    additional_notes: str = "",
    sender_name: str = "",
    api_key: Optional[str] = None,
) -> Dict[str, str]:
    """
    Analyzes candidate's resume and a target job role to generate
    a professional cold inquiry email inquiring about open vacancies.
    """
    if not resume_text or not resume_text.strip():
        raise ValueError("Resume text is empty. Please upload a valid resume.")

    if not target_job_role or not target_job_role.strip():
        raise ValueError("Please provide the kind of job / role you are searching for.")

    notes_section = f"\nAdditional Context / Preferences:\n{additional_notes}\n" if additional_notes else ""

    prompt = f"""You are an expert career advisor and cold outreach consultant.
A candidate is reaching out to potential employers, recruiters, or hiring managers to inquire about current or upcoming job opportunities matching their profile.

Candidate's Resume Text:
\"\"\"
{resume_text}
\"\"\"

Target Job / Role Sought:
\"{target_job_role}\"
{notes_section}
Candidate Name: {sender_name or 'the candidate'}

Task:
1. Review the candidate's core expertise, key achievements, and background from their resume.
2. Draft a crisp, courteous, and impactful cold outreach email that:
   - Inquires whether the recipient's organization has any current or upcoming openings for "{target_job_role}" (or related roles).
   - Introduces the candidate succinctly.
   - Summarizes 2 to 3 key strengths, relevant technologies, or accomplishments that bring immediate value.
   - Expresses genuine admiration/interest in contributing to their team.
   - Explicitly notes that their full resume is attached for review.
   - Welcomes a brief conversation or connection if an opportunity exists or arises.
   - Professional closing and signature block.

OUTPUT FORMAT REQUIREMENTS:
You MUST output ONLY a valid JSON object with EXACTLY two keys:
{{
  "subject": "The generated email subject line (e.g., Exploring Opportunities in [Target Role] - [Candidate Name])",
  "body": "The complete generated email body text with appropriate line breaks (\\n)"
}}
Do NOT include any other text, markdown explanations, or commentary outside of the JSON.
"""

    raw_response = call_gemini_api(prompt, api_key=api_key)
    return extract_json_response(raw_response)
