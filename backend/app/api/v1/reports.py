from __future__ import annotations

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.session_report import SessionReport
from app.schemas.session import SessionReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])
log = structlog.get_logger(__name__)


@router.get("/{session_id}", response_model=SessionReportResponse)
async def get_report(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> SessionReportResponse:
    result = await db.execute(
        select(SessionReport).where(SessionReport.session_id == session_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        log.info("Report not found", session_id=str(session_id))
        raise HTTPException(status_code=404, detail="Report not found")
    log.info("Report retrieved", session_id=str(session_id))
    return SessionReportResponse.model_validate(report)
