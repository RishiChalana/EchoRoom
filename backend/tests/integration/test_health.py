"""Health endpoint integration tests (requires running Docker services)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_health_returns_200_with_correct_shape(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "db" in data
    assert "redis" in data
    assert "version" in data
    assert "environment" in data


@pytest.mark.integration
async def test_health_db_reachable_in_ci(client: AsyncClient) -> None:
    """DB must be reachable when tests are run with Docker compose up."""
    data = (await client.get("/api/v1/health")).json()
    assert data["db"] == "healthy"
