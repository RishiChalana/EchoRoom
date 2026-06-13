from __future__ import annotations

import uuid
from typing import Any, Optional

from sqlalchemy import Float, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SessionReport(Base, TimestampMixin):
    __tablename__ = "session_reports"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), unique=True, nullable=False
    )
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    engagement_avg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    clarity_avg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    insights: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    rewrites: Mapped[list[Any]] = mapped_column(JSONB, default=list, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    coach_model: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    wpm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:
        return f"<SessionReport id={self.id} session_id={self.session_id}>"
