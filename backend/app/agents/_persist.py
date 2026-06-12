from __future__ import annotations

from typing import Optional

import structlog

from app.core.database import SyncSessionFactory
from app.models.agent_event import AgentEvent

log = structlog.get_logger(__name__)


def persist_event(
    session_id: str,
    chunk_id: Optional[str],
    agent_name: str,
    event_type: str,
    payload: dict,
    model_version: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
) -> None:
    """Append ONE AgentEvent row.

    LOCKED RULE #4: agent_events is append-only — insert only, never UPDATE or
    DELETE. Runs in the synchronous Celery worker context. A persistence failure
    must never break the live pipeline, so all exceptions are caught and logged.
    """
    try:
        with SyncSessionFactory() as db:
            db.add(
                AgentEvent(
                    session_id=session_id,
                    chunk_id=chunk_id,
                    agent_name=agent_name,
                    event_type=event_type,
                    payload=payload,
                    model_version=model_version,
                    processing_time_ms=processing_time_ms,
                )
            )
            db.commit()
    except Exception as exc:
        log.warning(
            "Failed to persist agent event",
            agent_name=agent_name,
            chunk_id=chunk_id,
            error=str(exc),
        )
