"""
ORM Models Registry

Import all models here so Alembic can discover them during autogenerate.
Add new models to this file as they are created.
"""
from app.models.base import Base, TimestampMixin  # noqa: F401
from app.models.session import Session  # noqa: F401
from app.models.agent_event import AgentEvent  # noqa: F401
from app.models.session_report import SessionReport  # noqa: F401

# ── Add future models here ────────────────────────────────────────────────────
# from app.models.user import User          # Week 10

__all__ = ["Base", "TimestampMixin", "Session", "AgentEvent", "SessionReport"]
