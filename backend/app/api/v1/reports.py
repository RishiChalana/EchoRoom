from __future__ import annotations

from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import ALGORITHM, get_current_user_optional
from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limit import limiter
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
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    # 1) The session must exist.
    session_result = await db.execute(select(Session).where(Session.id == session_id))
    session = session_result.scalar_one_or_none()
    if not session:
        log.info("Report requested for unknown session", session_id=str(session_id))
        raise HTTPException(status_code=404, detail="Session not found")

    # Public sessions are visible to anyone — skip ownership check entirely.
    # Private sessions enforce the original rule: if both session.user_email and
    # current_user are set and they don't match, 403.
    if not session.is_public:
        if session.user_email and current_user:
            if session.user_email != current_user.get("email"):
                raise HTTPException(status_code=403, detail="Not your session")

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
        # Scores normalised to 0-100 for display; stored as 0-10 / 0-1
        if response.overall_score is not None:
            response.overall_score = round(response.overall_score * 10)
        if response.engagement_avg is not None:
            response.engagement_avg = round(response.engagement_avg * 100)
        if response.clarity_avg is not None:
            response.clarity_avg = round(response.clarity_avg * 100)
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


@router.get("/{session_id}/audio", response_class=Response)
@limiter.limit("20/minute")
async def get_session_audio(
    request: Request,
    session_id: str,
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """
    Streams the session audio as a WebM blob.

    Accepts auth via Authorization: Bearer header OR a ?token= query parameter
    so that browser-native <audio src="..."> elements can fetch it without
    custom request headers (browsers don't support arbitrary headers on src).
    """
    try:
        sid = UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")

    # If no header auth but token param present, try to verify it directly.
    if current_user is None and token:
        try:
            import jwt as pyjwt  # noqa: PLC0415
            payload = pyjwt.decode(token, settings.NEXTAUTH_SECRET, algorithms=[ALGORITHM])
            email = payload.get("email")
            if email:
                current_user = {"email": email}
        except Exception:
            pass

    session_result = await db.execute(select(Session).where(Session.id == sid))
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.is_public:
        if session.user_email and current_user:
            if session.user_email != current_user.get("email"):
                raise HTTPException(status_code=403, detail="Not your session")

    report_result = await db.execute(
        select(SessionReport).where(SessionReport.session_id == sid)
    )
    report = report_result.scalar_one_or_none()

    if report is None or report.audio_data is None:
        raise HTTPException(status_code=404, detail="No audio recorded for this session")

    content_type = report.audio_content_type or "audio/webm"
    log.info("Audio served", session_id=str(sid), bytes=len(report.audio_data))
    return Response(content=report.audio_data, media_type=content_type)
