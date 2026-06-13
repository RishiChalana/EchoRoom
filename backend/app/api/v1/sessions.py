from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.session import Session
from app.schemas.session import CreateSessionRequest, SessionListResponse, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])
log = structlog.get_logger(__name__)


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    session = Session(
        status="active",
        audience_profile=body.audience_profile,
        name=body.name,
        report_ready=False,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session)
    log.info("Session created", session_id=str(session.id))
    return SessionResponse.model_validate(session)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        log.info("Session not found", session_id=str(session_id))
        raise HTTPException(status_code=404, detail="Session not found")
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


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
) -> SessionListResponse:
    stmt = select(Session)
    if status_filter:
        stmt = stmt.where(Session.status == status_filter)
    result = await db.execute(stmt)
    sessions = result.scalars().all()
    log.info("Sessions listed", count=len(sessions), status_filter=status_filter)
    return SessionListResponse(sessions=[SessionResponse.model_validate(s) for s in sessions])
