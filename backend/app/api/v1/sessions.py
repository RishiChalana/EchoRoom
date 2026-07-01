from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_optional
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.agent_event import AgentEvent
from app.models.session import Session
from app.models.session_report import SessionReport
from pydantic import BaseModel

from app.schemas.session import CreateSessionRequest, SessionListResponse, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])
log = structlog.get_logger(__name__)


def _check_ownership(session: Session, current_user: Optional[dict]) -> None:
    """Raise 403 if the session belongs to a different user."""
    if session.user_email and current_user:
        if session.user_email != current_user.get("email"):
            raise HTTPException(status_code=403, detail="Not your session")


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_session(
    request: Request,
    body: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> SessionResponse:
    user_email = current_user.get("email") if current_user else None
    session = Session(
        status="active",
        audience_profile=body.audience_profile,
        name=body.name,
        report_ready=False,
        is_public=False,
        user_email=user_email,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    log.info("Session created", session_id=str(session.id), user_email=user_email)
    return SessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> SessionResponse:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        log.info("Session not found", session_id=str(session_id))
        raise HTTPException(status_code=404, detail="Session not found")
    _check_ownership(session, current_user)
    log.info("Session retrieved", session_id=str(session_id))
    return SessionResponse.model_validate(session)


@router.patch("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        log.info("Session not found for end", session_id=str(session_id))
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status in ("complete", "failed"):
        log.info("Session already ended", session_id=str(session_id))
        raise HTTPException(status_code=400, detail="Session already ended")

    ended_at = datetime.now(timezone.utc)
    session.status = "processing"
    session.ended_at = ended_at
    if session.created_at is not None:
        created = session.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        session.duration_seconds = int((ended_at - created).total_seconds())

    await db.flush()
    await db.refresh(session)

    # Dispatch CoachAgent asynchronously — import inside function to avoid circular imports
    try:
        from app.workers.tasks import process_coach_session  # noqa: PLC0415
        process_coach_session.apply_async(args=[str(session_id)], queue="coach")
    except Exception as exc:
        log.warning("Failed to dispatch coach task", error=str(exc), session_id=str(session_id))

    log.info("Session ended, coach task dispatched", session_id=str(session_id))
    return SessionResponse.model_validate(session)


@router.delete("/{session_id}")
@limiter.limit("20/minute")
async def delete_session(
    request: Request,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> Response:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_ownership(session, current_user)
    # Delete associated report first (no cascade in FK definition)
    report_result = await db.execute(select(SessionReport).where(SessionReport.session_id == session_id))
    report = report_result.scalar_one_or_none()
    if report:
        await db.delete(report)
    await db.delete(session)
    await db.flush()
    log.info("Session deleted", session_id=str(session_id))
    return Response(status_code=204)


@router.get("/{session_id}/transcript")
@limiter.limit("30/minute")
async def get_session_transcript(
    request: Request,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> dict:
    """
    Returns all transcript_chunk events for a session ordered by created_at.
    Used by the frontend to recover state after a WebSocket reconnection —
    the WebSocket only streams forward, this endpoint provides the snapshot.
    """
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_ownership(session, current_user)

    transcript_result = await db.execute(
        select(AgentEvent)
        .where(AgentEvent.session_id == session_id)
        .where(AgentEvent.event_type == "transcript_chunk")
        .order_by(AgentEvent.created_at)
    )
    transcript_events = transcript_result.scalars().all()

    engagement_result = await db.execute(
        select(AgentEvent)
        .where(AgentEvent.session_id == session_id)
        .where(AgentEvent.event_type == "engagement_signal")
    )
    engagement_events = engagement_result.scalars().all()

    scores = [e.payload.get("score", 0.0) for e in engagement_events]
    latest_engagement_avg = round(sum(scores) / len(scores), 4) if scores else None

    chunks = [
        {
            "chunk_id": e.chunk_id if e.chunk_id else str(e.event_id),
            "session_id": str(session_id),
            "text": e.payload.get("text", ""),
            "language": e.payload.get("language", ""),
            "no_speech_prob": e.payload.get("no_speech_prob", 0.0),
            "created_at": e.created_at.isoformat(),
        }
        for e in transcript_events
    ]

    log.info("Transcript fetched", session_id=str(session_id), chunk_count=len(chunks))
    return {"transcript_chunks": chunks, "latest_engagement_avg": latest_engagement_avg}


class VisibilityRequest(BaseModel):
    is_public: bool


@router.patch("/{session_id}/visibility", response_model=SessionResponse)
@limiter.limit("20/minute")
async def set_session_visibility(
    request: Request,
    session_id: UUID,
    body: VisibilityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> SessionResponse:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _check_ownership(session, current_user)
    session.is_public = body.is_public
    await db.flush()
    await db.refresh(session)
    log.info(
        "Session visibility updated",
        session_id=str(session_id),
        is_public=body.is_public,
    )
    return SessionResponse.model_validate(session)


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> SessionListResponse:
    user_email = current_user.get("email") if current_user else None
    if not user_email:
        # No authenticated user — return empty rather than leaking all sessions
        return SessionListResponse(sessions=[])

    stmt = select(Session).where(Session.user_email == user_email)
    if status_filter:
        stmt = stmt.where(Session.status == status_filter)
    stmt = stmt.order_by(Session.created_at.desc())
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    log.info("Sessions listed", count=len(sessions), user_email=user_email)
    return SessionListResponse(sessions=[SessionResponse.model_validate(s) for s in sessions])
