from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Dict

from pydantic import BaseModel, Field


StatusLiteral = Literal["healthy", "degraded", "unhealthy", "unknown"]


class HealthResponse(BaseModel):
    """Basic health response — returned by GET /api/v1/health."""
    status: StatusLiteral = "healthy"
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {"json_schema_extra": {
        "example": {
            "status": "healthy",
            "version": "0.1.0",
            "environment": "development",
            "timestamp": "2024-01-01T00:00:00Z",
        }
    }}


class ServiceStatus(BaseModel):
    """Status of a single downstream dependency."""
    name: str
    status: StatusLiteral
    message: str | None = None


class FullHealthResponse(HealthResponse):
    """Full health response including all dependency statuses."""
    services: Dict[str, ServiceStatus]
    latency_ms: float

    model_config = {"json_schema_extra": {
        "example": {
            "status": "healthy",
            "version": "0.1.0",
            "environment": "development",
            "timestamp": "2024-01-01T00:00:00Z",
            "services": {
                "database": {"name": "PostgreSQL", "status": "healthy"},
                "redis": {"name": "Redis", "status": "healthy"},
            },
            "latency_ms": 12.4,
        }
    }}
