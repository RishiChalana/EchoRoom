from __future__ import annotations

from pathlib import Path
from typing import List

import instructor
import redis
import structlog
from openai import OpenAI
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.events import ClarityAnalysis, ClarityIssue

log = structlog.get_logger(__name__)

_PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "clarity_system.txt"


class _ClarityResponse(BaseModel):
    score: float
    issues: List[ClarityIssue]


def analyze_clarity(session_id: str, chunk_id: str, text: str) -> ClarityAnalysis:
    system_prompt = _PROMPT_PATH.read_text()
    client = instructor.from_openai(OpenAI(api_key=settings.OPENAI_API_KEY))

    response: _ClarityResponse = client.chat.completions.create(
        model="gpt-4o-mini",
        response_model=_ClarityResponse,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Segment transcript:\n{text}"},
        ],
        max_retries=2,
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

    log.info("Clarity analyzed", session_id=session_id, chunk_id=chunk_id, score=analysis.score)
    return analysis
