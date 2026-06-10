from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.integration
async def test_full_health_check(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/full")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "services" in data
    assert "database" in data["services"]
    assert "redis" in data["services"]
    assert "latency_ms" in data
    assert data["latency_ms"] >= 0
