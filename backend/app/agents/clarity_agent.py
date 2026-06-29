from __future__ import annotations

import logging
from pathlib import Path
from typing import List

import instructor
import structlog
from openai import OpenAI
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.schemas.events import ClarityIssue

log = structlog.get_logger(__name__)
logger = logging.getLogger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "clarity_system.txt"

# Gemini's OpenAI-compatible endpoint — the trailing slash is REQUIRED.
_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_MODEL = "gemini-2.5-flash"

# Module-level key check — fires once per Celery worker process startup.
if not settings.GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY is empty — clarity analysis will always fail")
else:
    logger.info(
        "GEMINI_API_KEY loaded, length: %d, prefix: %s...",
        len(settings.GEMINI_API_KEY),
        settings.GEMINI_API_KEY[:6],
    )


class _ClarityResponse(BaseModel):
    score: float
    issues: List[ClarityIssue]


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
def _call_gemini(
    client: instructor.Instructor,
    system_prompt: str,
    room_note: str,
    full_text: str,
) -> _ClarityResponse:
    return client.chat.completions.create(
        model=_MODEL,
        response_model=_ClarityResponse,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{room_note}Full session transcript:\n{full_text}"},
        ],
        max_retries=1,
    )


def analyze_transcript_clarity(
    session_id: str,
    full_text: str,
    audience_profile: str = "general",
) -> dict:
    """One-shot clarity analysis over an entire session transcript.

    Returns {"score": float | None, "issues": [ClarityIssue dicts]}. Used by the
    coach agent at session end — a single LLM call instead of per-chunk. Never
    raises: on failure returns score=None so the report can still generate.
    """
    if not full_text or not full_text.strip():
        return {"score": 1.0, "issues": []}

    system_prompt = _PROMPT_PATH.read_text()
    client = instructor.from_openai(
        OpenAI(
            api_key=settings.GEMINI_API_KEY,
            base_url=_BASE_URL,
            timeout=30.0,
        ),
        mode=instructor.Mode.JSON,
    )

    room_note = f"Note: This is a {audience_profile} communication context.\n\n"

    try:
        response = _call_gemini(client, system_prompt, room_note, full_text)
    except Exception as exc:
        logger.error(
            "Clarity analysis failed: %s: %s",
            type(exc).__name__, str(exc),
            exc_info=True,
        )
        log.error(
            "clarity batch failed",
            session_id=session_id,
            exc_type=type(exc).__name__,
            error=str(exc),
        )

        error_message = str(exc).lower()
        if "rate limit" in error_message or "429" in error_message:
            fallback_reason = "Rate limited by the AI provider."
        elif "api key" in error_message or "401" in error_message or "403" in error_message:
            fallback_reason = "AI provider authentication failed."
        elif "timeout" in error_message:
            fallback_reason = "AI provider request timed out."
        else:
            fallback_reason = f"Unexpected error: {type(exc).__name__}: {str(exc)[:120]}"

        return {"score": None, "issues": [], "error": fallback_reason}

    score = round(max(0.0, min(1.0, response.score)), 4)
    log.info(
        "Clarity batch analyzed",
        session_id=session_id,
        score=score,
        audience_profile=audience_profile,
    )
    return {"score": score, "issues": [i.model_dump() for i in response.issues]}
