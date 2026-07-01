from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text  # noqa: F401
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Session(Base, TimestampMixin):
    __tablename__ = "sessions"

    status: Mapped[str] = mapped_column(Text, default="active", nullable=False)
    audience_profile: Mapped[str] = mapped_column(Text, default="general", nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    user_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    overall_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    report_ready: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<Session id={self.id} status={self.status!r}>"
