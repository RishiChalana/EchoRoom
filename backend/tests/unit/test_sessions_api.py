from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.v1.sessions import router as sessions_router
from app.core.database import get_db


def _make_app(db_mock) -> FastAPI:
    app = FastAPI()

    async def _override():
        yield db_mock

    app.dependency_overrides[get_db] = _override
    app.include_router(sessions_router)
    return app


@pytest.mark.asyncio
async def test_create_session_returns_201():
    _id = uuid.uuid4()
    _now = datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc)

    async def _do_refresh(obj):
        obj.id = _id
        obj.created_at = _now

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock(side_effect=_do_refresh)

    async with AsyncClient(
        transport=ASGITransport(app=_make_app(mock_db)), base_url="http://test"
    ) as ac:
        resp = await ac.post("/sessions", json={"audience_profile": "technical"})

    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "active"
    assert data["audience_profile"] == "technical"
    assert data["id"] == str(_id)


@pytest.mark.asyncio
async def test_create_session_with_invalid_profile_returns_422():
    mock_db = AsyncMock()

    async with AsyncClient(
        transport=ASGITransport(app=_make_app(mock_db)), base_url="http://test"
    ) as ac:
        resp = await ac.post("/sessions", json={"audience_profile": 123})

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_unknown_session_returns_404():
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    async with AsyncClient(
        transport=ASGITransport(app=_make_app(mock_db)), base_url="http://test"
    ) as ac:
        resp = await ac.get(f"/sessions/{uuid.uuid4()}")

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Session not found"


@pytest.mark.asyncio
async def test_end_session_sets_processing_status():
    session_id = uuid.uuid4()
    fake = SimpleNamespace(
        id=session_id,
        status="active",
        audience_profile="general",
        report_ready=False,
        duration_seconds=None,
        overall_score=None,
        ended_at=None,
        created_at=datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()

    async with AsyncClient(
        transport=ASGITransport(app=_make_app(mock_db)), base_url="http://test"
    ) as ac:
        resp = await ac.patch(f"/sessions/{session_id}/end")

    assert resp.status_code == 200
    assert resp.json()["status"] == "processing"
    assert fake.ended_at is not None


@pytest.mark.asyncio
async def test_end_already_complete_session_returns_400():
    session_id = uuid.uuid4()
    fake = SimpleNamespace(
        id=session_id,
        status="complete",
        audience_profile="general",
        report_ready=True,
        duration_seconds=300,
        overall_score=7.5,
        ended_at=datetime(2024, 6, 1, 13, 0, 0, tzinfo=timezone.utc),
        created_at=datetime(2024, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = fake
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=mock_result)

    async with AsyncClient(
        transport=ASGITransport(app=_make_app(mock_db)), base_url="http://test"
    ) as ac:
        resp = await ac.patch(f"/sessions/{session_id}/end")

    assert resp.status_code == 400
    assert resp.json()["detail"] == "Session already ended"
