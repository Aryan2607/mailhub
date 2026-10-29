import json
import logging
import re
from typing import Any, Dict, Optional
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-flash-latest",
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
            "temperature": 0.5,
            "maxOutputTokens": 8192,
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
    match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw_text)
    candidate_text = match.group(1) if match else None

    if candidate_text:
        try:
            data = json.loads(candidate_text)
            if isinstance(data, dict) and "subject" in data and "body" in data:
                return {
                    "subject": str(data.get("subject", "")).strip(),
                    "body": str(data.get("body", "")).strip(),
                }
        except Exception:
            pass

    # Look for outer { ... }
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate_text = raw_text[start : end + 1]
        try:
            data = json.loads(candidate_text)
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
    a tailored, realistic, and highly compelling job application email (subject & body).
    """
    if not resume_text or not resume_text.strip():
        raise ValueError("Resume text is empty. Please upload a valid resume.")

    if not job_post or not job_post.strip():
        raise ValueError("Please provide the job posting or vacancy details.")

    prompt = f"""You are an elite talent strategist, executive career coach, and master copywriter.
A candidate is sending a personalized, highly persuasive job application email directly to a recruiter or hiring manager.

Candidate's Resume:
\"\"\"
{resume_text}
\"\"\"

Job Posting / Vacancy Details:
\"\"\"
{job_post}
\"\"\"

Recipient Email / Contact: {recipient_email or 'Hiring Team'}
Candidate Name: {sender_name or 'the candidate'}

MISSION:
Write a compelling, authentic, and attractive job application email that sounds like it was written by an articulate, high-caliber professional—NOT an AI.

CRITICAL INSTRUCTIONS:
1. INTELLIGENT POSITIONING & RELEVANCE TRANSLATION:
   - Identify the candidate's core transferrable skills, actual education, practical training, and achievements from the resume.
   - Professionally contextualize and adapt these skills to directly match the target role:
     * If the role is Customer Support / Customer Service / Client Success / Operations:
       Highlight direct customer engagement, active listening, root-cause problem diagnosis, empathetic resolution, case follow-through, client retention, digital documentation, and technical computer literacy (e.g. Diploma in Computer Application or equivalent).
     * DO NOT copy-paste raw, awkward niche activities verbatim (e.g., NEVER mention 'mushroom cultivation', 'handicraft rakhi making', or 'counseling personal/economic distress' in corporate/customer support applications). Instead, translate those experiences into genuine business strengths: direct client interaction, understanding customer needs, structured problem assessment, and case-level resolution.
2. 100% FACTUAL FIDELITY:
   - Strictly ground every claim in actual qualifications and history found in the candidate's resume (e.g., Diploma in Computer Application from Mahamaya Technical and Professional College, degree in Rural Technology & Social Development, MSW, case intervention, client interaction, exposure to structured organizational workflows like Coca-Cola, NTPC, BSNL).
   - Extract and list candidate's actual phone number, email address, and LinkedIn profile from the resume in the sign-off block.
   - NEVER fabricate certifications, job titles, or companies that do not exist in the resume.
3. NATURAL, HUMAN, & PERSUASIVE TONE:
   - Write with clarity, warmth, and confidence.
   - Strictly AVOID robotic AI clichés and filler:
     * BAN: "I am writing to express my keen interest in the position of..."
     * BAN: "With a strong background in... I am confident in my ability..."
     * BAN: "My training as a... has provided me with practical hands-on experience..."
     * BAN: "Furthermore, my experience in..."
     * BAN: "In addition to that..."
     * BAN: "I am eager to leverage my strengths..."
     * BAN: "These experiences have honed my..."
   - Use crisp, punchy sentences. Make it engaging and easy to read.
4. STRUCTURE & FORMAT:
   - Subject Line: Engaging, professional, and clear (e.g., "[Candidate Name] – Application for [Role Title] | [Key Strength / Value]")
   - Greeting: Address the recipient respectfully. If a name can be naturally inferred from the recipient email (e.g., aryanagrawal2607@gmail.com -> "Dear Aryan,"), use it. Otherwise, use "Dear Hiring Team,".
   - Opening (1-2 sentences): Direct statement of interest for the specific position, establishing immediate relevance and enthusiasm.
   - Value Pillars (3 concise, bulleted highlights):
     * Format with bold headings (e.g., "* **Client Engagement & Communication:** ...")
     * Each bullet must highlight a concrete capability backed by their resume, showing how it solves problems for the employer.
   - Resume & Call-to-Action (1-2 sentences): Mention that the full resume is attached with complete background details, and invite a brief introductory conversation or interview.
   - Sign-off & Signature Block: Professional sign-off ("Warm regards," or "Sincerely,"), candidate full name, phone number, and email accurately extracted from the resume. For LinkedIn: If a LinkedIn URL or web link is found in the resume or extracted links, YOU MUST format it as a full, direct URL (e.g., "LinkedIn: https://www.linkedin.com/in/..."). NEVER output just the candidate's plain name for LinkedIn. If no LinkedIn URL or link exists, omit the LinkedIn line completely.

OUTPUT FORMAT REQUIREMENTS:
Output ONLY a valid JSON object with EXACTLY two keys:
{{
  "subject": "The generated email subject line",
  "body": "The complete generated email body text with appropriate line breaks (\\n)"
}}
Do NOT wrap with markdown commentary or extra explanation outside of JSON.
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
    a professional, realistic, and high-converting cold outreach email.
    """
    if not resume_text or not resume_text.strip():
        raise ValueError("Resume text is empty. Please upload a valid resume.")

    if not target_job_role or not target_job_role.strip():
        raise ValueError("Please provide the kind of job / role you are searching for.")

    notes_section = f"\nAdditional Context / Preferences:\n{additional_notes}\n" if additional_notes else ""

    prompt = f"""You are an elite career advisor, corporate talent scout, and outreach copywriter.
A candidate is reaching out to prospective employers, recruiters, or department heads to explore career opportunities.

Candidate's Resume:
\"\"\"
{resume_text}
\"\"\"

Target Job / Role Sought:
\"{target_job_role}\"
{notes_section}
Candidate Name: {sender_name or 'the candidate'}

MISSION:
Draft a crisp, courteous, and high-converting cold outreach inquiry email that grabs attention, looks 100% human and authentic, and accurately showcases the candidate's real qualifications.

CRITICAL INSTRUCTIONS:
1. INTELLIGENT POSITIONING:
   - Analyze the candidate's actual qualifications from the resume and align them with the target role ("{target_job_role}").
   - Highlight transferable skills relevant to the target role (e.g., direct customer relations, problem diagnosis, digital systems & Diploma in Computer Application, structured workflow exposure).
   - DO NOT include raw, awkward niche activities verbatim (e.g. avoid 'mushroom production', 'rakhi making', or 'counseling personal/economic distress' for corporate roles). Professionally reframe them into practical experience in client interaction, problem assessment, and operational execution.
2. 100% FACTUAL ACCURACY:
   - Strictly reflect the candidate's actual education, background, and practical experience from the resume.
   - Never fabricate nonexistent skills, companies, or degrees.
3. HUMAN & COMPELLING TONE:
   - Keep it concise, respectful, and engaging—executives read emails on mobile in under 20 seconds.
   - Strictly AVOID robotic AI openings like "I am writing to inquire if you have any vacancies..." or "I hope this email finds you well. My name is...".
   - Start with a punchy, polite hook expressing interest in contributing to their team.
4. STRUCTURE:
   - Subject Line: Crisp and compelling (e.g., "Exploring Opportunities in {target_job_role} – [Candidate Name]" or "[Candidate Name] | Inquiry: {target_job_role}")
   - Greeting: "Dear Hiring Team," or "Dear [Company/Team] Leader,"
   - Opening: Brief introduction and direct inquiry regarding current or upcoming opportunities in {target_job_role}.
   - Core Strengths (2-3 punchy bullet points): Key transferable capabilities from resume relevant to this role.
   - Call-to-Action: Mention that the complete resume is attached, and politely invite a brief 10-minute introductory conversation.
   - Signature Block: Candidate full name, phone number, and email accurately drawn from the resume. For LinkedIn: If a LinkedIn URL or web link is found in the resume or extracted links, format it as a full URL (e.g. "LinkedIn: https://www.linkedin.com/in/..."). Never write just the candidate's name for LinkedIn. If no URL exists, omit the LinkedIn line.

OUTPUT FORMAT REQUIREMENTS:
Output ONLY a valid JSON object with EXACTLY two keys:
{{
  "subject": "The generated email subject line",
  "body": "The complete generated email body text with appropriate line breaks (\\n)"
}}
Do NOT wrap with markdown commentary or extra explanation outside of JSON.
"""

    raw_response = call_gemini_api(prompt, api_key=api_key)
    return extract_json_response(raw_response)
