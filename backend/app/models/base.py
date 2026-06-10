"""
SQLAlchemy ORM Models

This module re-exports Base and TimestampMixin for convenient imports.
All ORM models must import Base from here (not from core.database directly)
so that Alembic can discover them via autogenerate.

Usage:
    from app.models.base import Base, TimestampMixin
    
    class Session(Base, TimestampMixin):
        __tablename__ = "sessions"
        ...
"""
from app.core.database import Base, TimestampMixin

__all__ = ["Base", "TimestampMixin"]
