from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel


AudienceProfile = Literal["general", "technical", "interview", "presentation"]

SessionStatus = Literal["active", "processing", "complete", "failed"]


class CreateSessionRequest(BaseModel):
    audience_profile: AudienceProfile = "general"
    name: Optional[str] = None


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
    wpm: Optional[int] = None
    engagement_timeline: List[EngagementTimelinePoint] = []

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    sessions: List[SessionResponse]


class EngagementTimelinePoint(BaseModel):
    index: int
    engagement_score: float
    text_preview: str = ""


class SessionReportResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    overall_score: Optional[int] = None
    engagement_avg: Optional[int] = None
    clarity_avg: Optional[int] = None
    insights: List = []
    rewrites: List = []
    summary: Optional[str] = None
    coach_model: Optional[str] = None
    created_at: datetime
    # Computed read-side at GET time from agent_events; defaults empty so older
    # reports (and the ORM row, which has no such column) still deserialize.
    wpm: Optional[int] = None
    engagement_timeline: List[EngagementTimelinePoint] = []

    model_config = {"from_attributes": True}
