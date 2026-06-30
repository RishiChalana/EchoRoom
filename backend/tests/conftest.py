"""
Test configuration and shared fixtures.

CRITICAL: env-var overrides are set BEFORE any app module is imported.
pydantic-settings gives env vars higher priority than .env files, so setting
them here ensures the app engine points at the test DB, not the dev DB.
"""
from __future__ import annotations

import os

# ── Override config BEFORE any app import ─────────────────────────────────────
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://echoroom:echoroom_dev_pass@localhost:5432/echoroom_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["NEXTAUTH_SECRET"] = "test-secret-for-pytest-only"
os.environ["ENVIRONMENT"] = "development"
os.environ.setdefault("SECRET_KEY", "test-only-secret-key")
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-real")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")

# ── App imports (safe now that env is configured) ─────────────────────────────
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import create_engine as sync_create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core import database as _db_module
from app.core.database import Base, get_db
from app.main import app  # triggers all model imports, registering metadata

# ── Patch AsyncSessionFactory to use NullPool ─────────────────────────────────
# check_db_health() (called by the health endpoint) uses AsyncSessionFactory
# directly — it does NOT go through Depends(get_db) and cannot be overridden
# via app.dependency_overrides.  With pytest-asyncio's function-scoped event
# loops, each test runs in its own loop.  A default QueuePool holds connections
# across tests; when a previous loop closes before asyncpg can cancel a pending
# operation the connection becomes a zombie and causes "got Future attached to a
# different loop" in the next test.
# NullPool creates a brand-new connection on each use and closes it immediately,
# so there are no pooled connections to become zombies.
_null_engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
_db_module.AsyncSessionFactory = async_sessionmaker(
    _null_engine, class_=AsyncSession, expire_on_commit=False
)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Drop and recreate the test schema once per pytest session.

    Uses psycopg2 (synchronous) to avoid event-loop-scope issues that come
    with session-scoped async fixtures in pytest-asyncio.
    """
    sync_url = TEST_DATABASE_URL.replace("+asyncpg", "+psycopg2")
    engine = sync_create_engine(sync_url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    engine.dispose()
    yield


@pytest_asyncio.fixture
async def db_session():
    """Async session bound to a fresh engine, function-scoped.

    A new engine is created per test to avoid asyncpg connections being bound
    to a stale event loop from a previous test — pytest-asyncio creates a new
    event loop per test function by default, and asyncpg connection pools are
    NOT safe to reuse across event loops.
    """
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """HTTPX test client wired to the app with the test DB session injected."""
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
