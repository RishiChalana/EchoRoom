"""
Tests for the /api/v1/health endpoints.
These are integration tests that require the API to be running.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_returns_200(client: AsyncClient) -> None:
    """Basic health check should always return 200."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "environment" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_health_version_matches_config(client: AsyncClient) -> None:
    from app.core.config import settings
    response = await client.get("/api/v1/health")
    assert response.json()["version"] == settings.APP_VERSION


@pytest.mark.asyncio
@pytest.mark.integration
async def test_full_health_check(client: AsyncClient) -> None:
    """Full health check — requires running PostgreSQL and Redis."""
    response = await client.get("/api/v1/health/full")
    # Accept 200 (all healthy) or 503 (dependency down)
    assert response.status_code in (200, 503)
    data = response.json()
    assert "services" in data
    assert "database" in data["services"]
    assert "redis" in data["services"]
    assert "latency_ms" in data
    assert data["latency_ms"] >= 0
