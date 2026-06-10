from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base


class AgentEvent(Base):
    # Append-only audit log — rows must never be updated or deleted (CLAUDE.md LOCKED)
    __tablename__ = "agent_events"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=False
    )
    chunk_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agent_name: Mapped[str] = mapped_column(Text, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model_version: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    processing_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_agent_events_payload_gin", "payload", postgresql_using="gin"),
        Index("ix_agent_events_agent_name_created_at", "agent_name", "created_at"),
        Index("ix_agent_events_session_id", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<AgentEvent event_id={self.event_id} agent={self.agent_name!r} type={self.event_type!r}>"
