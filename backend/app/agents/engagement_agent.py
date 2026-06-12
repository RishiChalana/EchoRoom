from __future__ import annotations

import re

import redis
import structlog

from app.agents._persist import persist_event
from app.core.config import settings
from app.schemas.events import EngagementSignal

log = structlog.get_logger(__name__)

# LOCKED RULE: EngagementClassifier uses local heuristic logic only — never LLM
_FILLERS = frozenset(
    ["um", "uh", "like", "you know", "basically", "actually", "right", "so", "okay"]
)


def _compute_features(text: str) -> dict[str, float]:
    words = re.findall(r"\b\w+\b", text.lower())
    if not words:
        return {
            "filler_ratio": 0.0,
            "type_token_ratio": 0.0,
            "avg_word_len": 0.0,
            "sentence_count": 0.0,
        }

    filler_count = sum(1 for w in words if w in _FILLERS)
    sentences = [s for s in re.split(r"[.!?]+", text.strip()) if s.strip()]

    return {
        "filler_ratio": filler_count / len(words),
        "type_token_ratio": len(set(words)) / len(words),
        "avg_word_len": sum(len(w) for w in words) / len(words),
        "sentence_count": float(len(sentences)),
    }


def classify_engagement(session_id: str, chunk_id: str, text: str) -> EngagementSignal:
    features = _compute_features(text)

    score = (
        (1.0 - min(features["filler_ratio"] * 3, 1.0)) * 0.4
        + min(features["type_token_ratio"] * 1.2, 1.0) * 0.4
        + min(max((features["avg_word_len"] - 3) / 5, 0.0), 1.0) * 0.2
    )
    score = round(max(0.0, min(1.0, score)), 4)

    if score < 0.35:
        label = "low"
    elif score < 0.65:
        label = "medium"
    else:
        label = "high"

    signal = EngagementSignal(
        chunk_id=chunk_id,
        session_id=session_id,
        score=score,
        label=label,
        features={k: round(v, 4) for k, v in features.items()},
    )

    r = redis.from_url(settings.REDIS_URL)
    try:
        r.publish(f"engagement:{session_id}", signal.model_dump_json())
    finally:
        r.close()

    persist_event(
        session_id,
        chunk_id,
        agent_name="engagement_classifier",
        event_type="engagement_signal",
        payload={"score": signal.score, "label": signal.label},
    )

    log.info("Engagement classified", session_id=session_id, chunk_id=chunk_id, label=label)
    return signal
