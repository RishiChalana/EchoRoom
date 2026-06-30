"""Health endpoint unit tests."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


async def test_health_always_returns_200(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200


async def test_health_response_shape(client: AsyncClient) -> None:
    data = (await client.get("/api/v1/health")).json()
    # status is "healthy" or "degraded" depending on Redis availability in CI
    assert data["status"] in ("healthy", "degraded")
    assert "version" in data
    assert "environment" in data
    assert "db" in data
    assert "redis" in data


async def test_health_version_matches_config(client: AsyncClient) -> None:
    from app.core.config import settings
    data = (await client.get("/api/v1/health")).json()
    assert data["version"] == settings.APP_VERSION
