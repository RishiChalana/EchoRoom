from __future__ import annotations

import time

from fastapi import APIRouter, Response, status
import structlog

from app.core.config import settings
from app.core.database import check_db_health
from app.core.redis import check_redis_health
from app.schemas.health import HealthResponse, ServiceStatus, FullHealthResponse

router = APIRouter(prefix="/health", tags=["health"])
log = structlog.get_logger(__name__)


@router.get(
    "",
    response_model=HealthResponse,
    summary="Basic health check",
    description="Returns 200 if the API process is running. Does not check dependencies.",
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get(
    "/full",
    response_model=FullHealthResponse,
    summary="Full dependency health check",
    description="Checks PostgreSQL and Redis connectivity. Returns 503 if any dependency is down.",
)
async def full_health(response: Response) -> FullHealthResponse:
    """Check all upstream dependencies and return aggregate status."""
    started_at = time.perf_counter()

    # Run dependency checks
    db_ok = await check_db_health()
    redis_ok = await check_redis_health()

    all_healthy = db_ok and redis_ok
    latency_ms = round((time.perf_counter() - started_at) * 1000, 2)

    overall = "healthy" if all_healthy else "degraded"
    response.status_code = (
        status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    log.info(
        "Full health check",
        status=overall,
        db_healthy=db_ok,
        redis_healthy=redis_ok,
        latency_ms=latency_ms,
    )

    return FullHealthResponse(
        status=overall,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        services={
            "database": ServiceStatus(
                name="PostgreSQL",
                status="healthy" if db_ok else "unhealthy",
            ),
            "redis": ServiceStatus(
                name="Redis",
                status="healthy" if redis_ok else "unhealthy",
            ),
        },
        latency_ms=latency_ms,
    )
