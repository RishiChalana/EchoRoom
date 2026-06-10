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
