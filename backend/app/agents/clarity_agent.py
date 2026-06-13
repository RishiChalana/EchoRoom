from __future__ import annotations

from pathlib import Path
from typing import List

import instructor
import redis
import structlog
from openai import OpenAI
from pydantic import BaseModel

from app.agents._persist import persist_event
from app.core.config import settings
from app.schemas.events import ClarityAnalysis, ClarityIssue

log = structlog.get_logger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "clarity_system.txt"

# Gemini's OpenAI-compatible endpoint — the trailing slash is REQUIRED.
_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_MODEL = "gemini-2.5-flash"


class _ClarityResponse(BaseModel):
    score: float
    issues: List[ClarityIssue]


def analyze_clarity(session_id: str, chunk_id: str, text: str) -> ClarityAnalysis:
    system_prompt = _PROMPT_PATH.read_text()
    client = instructor.from_openai(
        OpenAI(api_key=settings.GEMINI_API_KEY, base_url=_BASE_URL, timeout=30.0),
        mode=instructor.Mode.JSON,
    )

    response: _ClarityResponse = client.chat.completions.create(
        model=_MODEL,
        response_model=_ClarityResponse,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Segment transcript:\n{text}"},
        ],
        max_retries=1,
    )

    analysis = ClarityAnalysis(
        chunk_id=chunk_id,
        session_id=session_id,
        score=round(max(0.0, min(1.0, response.score)), 4),
        issues=response.issues,
    )

    r = redis.from_url(settings.REDIS_URL)
    try:
        r.publish(f"clarity:{session_id}", analysis.model_dump_json())
    finally:
        r.close()

    persist_event(
        session_id,
        chunk_id,
        agent_name="clarity_analyzer",
        event_type="clarity_analysis",
        payload={
            "score": analysis.score,
            "issues": [i.model_dump() for i in analysis.issues],
        },
    )

    log.info("Clarity analyzed", session_id=session_id, chunk_id=chunk_id, score=analysis.score)
    return analysis


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
            timeout=30.0,  # fail fast
        ),
        mode=instructor.Mode.JSON,
    )

    room_note = f"Note: This is a {audience_profile} communication context.\n\n"

    try:
        response: _ClarityResponse = client.chat.completions.create(
            model=_MODEL,
            response_model=_ClarityResponse,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{room_note}Full session transcript:\n{full_text}"},
            ],
            max_retries=1,
        )
    except Exception as exc:
        log.warning("clarity batch fell back", session_id=session_id, error=str(exc))
        return {"score": None, "issues": [], "error": str(exc)}

    score = round(max(0.0, min(1.0, response.score)), 4)
    log.info("Clarity batch analyzed", session_id=session_id, score=score, audience_profile=audience_profile)
    return {"score": score, "issues": [i.model_dump() for i in response.issues]}