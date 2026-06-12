from __future__ import annotations

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.agent_event import AgentEvent
from app.models.session import Session
from app.models.session_report import SessionReport
from app.schemas.session import EngagementTimelinePoint, SessionReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])
log = structlog.get_logger(__name__)


async def _build_engagement_timeline(
    db: AsyncSession, session_id: UUID
) -> list[EngagementTimelinePoint]:
    """Real per-chunk engagement series, computed read-side from agent_events.

    Engagement events in created_at order become the X axis; each point carries
    the engagement score and a short preview of the matching transcript chunk.
    """
    result = await db.execute(
        select(AgentEvent)
        .where(AgentEvent.session_id == session_id)
        .order_by(AgentEvent.created_at)
    )
    events = result.scalars().all()

    text_by_chunk = {
        e.chunk_id: (e.payload or {}).get("text", "")
        for e in events
        if e.agent_name == "transcript" and e.chunk_id
    }

    timeline: list[EngagementTimelinePoint] = []
    for e in events:
        if e.agent_name != "engagement_classifier":
            continue
        score = (e.payload or {}).get("score")
        if score is None:
            continue
        preview = (text_by_chunk.get(e.chunk_id, "") or "")[:40]
        timeline.append(
            EngagementTimelinePoint(
                index=len(timeline),
                engagement_score=float(score),
                text_preview=preview,
            )
        )
    return timeline


# No strict response_model: this route may return a 202 "generating" JSONResponse
# in addition to the 200 SessionReportResponse body.
@router.get("/{session_id}")
async def get_report(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    # 1) The session must exist.
    session_result = await db.execute(select(Session).where(Session.id == session_id))
    session = session_result.scalar_one_or_none()
    if not session:
        log.info("Report requested for unknown session", session_id=str(session_id))
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status == "active":
        raise HTTPException(status_code=409, detail="Session still active")

    # 2) Look up the report row.
    report_result = await db.execute(
        select(SessionReport).where(SessionReport.session_id == session_id)
    )
    report = report_result.scalar_one_or_none()

    if report is not None:
        log.info("Report retrieved", session_id=str(session_id))
        response = SessionReportResponse.model_validate(report)
        response.engagement_timeline = await _build_engagement_timeline(db, session_id)
        return response

    # 3) No report yet. While processing — or complete-without-report, which
    # shouldn't happen after the coach's always-save guarantee — tell the client
    # to keep polling.
    if session.status in ("processing", "complete"):
        log.info("Report still generating", session_id=str(session_id), status=session.status)
        return JSONResponse(
            status_code=202,
            content={"status": "generating", "session_id": str(session_id)},
        )

    # status == "failed" (or any other) with no report row.
    log.info("Report not available", session_id=str(session_id), status=session.status)
    raise HTTPException(status_code=404, detail="Report not available")
