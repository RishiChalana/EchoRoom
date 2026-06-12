from __future__ import annotations

from collections.abc import AsyncGenerator
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedColumn, mapped_column, sessionmaker
from sqlalchemy import DateTime, UUID as SAUUID
from datetime import datetime
from typing import Optional
from sqlalchemy.sql import func
import uuid
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_pre_ping=True,               # recycle stale connections
    pool_recycle=3600,                # recycle connections every hour
)

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Sync Engine + Session Factory (Celery worker context) ─────────────────────
# Agents run inside Celery (synchronous), not async FastAPI, so they need a sync
# session. Built alongside — never replaces — the async engine above.
# database_url_sync swaps +asyncpg → +psycopg2 (psycopg2-binary is installed).
sync_engine = create_engine(
    settings.database_url_sync,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    pool_recycle=3600,
)

SyncSessionFactory = sessionmaker(
    bind=sync_engine,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


# ── Declarative Base ──────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """
    All SQLAlchemy ORM models inherit from this base.
    Import Base in alembic/env.py so Alembic can detect schema changes.
    """
    pass


# ── Timestamp Mixin ───────────────────────────────────────────────────────────
class TimestampMixin:
    """Adds id, created_at, updated_at to any model."""

    id: MappedColumn[uuid.UUID] = mapped_column(
        SAUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields an async DB session per request."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Health Check ──────────────────────────────────────────────────────────────
async def check_db_health() -> bool:
    """Returns True if database is reachable."""
    try:
        async with AsyncSessionFactory() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        log.error("Database health check failed", error=str(exc))
        return False
