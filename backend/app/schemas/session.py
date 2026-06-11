from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


class CreateSessionRequest(BaseModel):
    audience_profile: str = "general"


SessionStatus = Literal["active", "processing", "complete", "failed"]


class SessionResponse(BaseModel):
    id: uuid.UUID
    status: SessionStatus
    audience_profile: str
    duration_seconds: Optional[int] = None
    overall_score: Optional[float] = None
    created_at: datetime
    ended_at: Optional[datetime] = None
    report_ready: bool

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]


class SessionReportResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    overall_score: Optional[float] = None
    engagement_avg: Optional[float] = None
    clarity_avg: Optional[float] = None
    insights: List = []
    rewrites: List = []
    summary: Optional[str] = None
    coach_model: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
