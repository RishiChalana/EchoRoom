"""
ORM Models Registry

Import all models here so Alembic can discover them during autogenerate.
Add new models to this file as they are created.
"""
from app.models.base import Base, TimestampMixin  # noqa: F401

# ── Add future models here ────────────────────────────────────────────────────
# from app.models.user import User          # Week 10
# from app.models.session import Session   # Week 1 (agent sessions)
# from app.models.agent_event import AgentEvent  # Week 2

__all__ = ["Base", "TimestampMixin"]
