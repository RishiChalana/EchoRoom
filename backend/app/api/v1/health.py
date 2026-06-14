from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import structlog

from app.core.config import settings
from app.core.database import check_db_health
from app.core.redis import check_redis_health, get_redis_client

router = APIRouter(prefix="/health", tags=["health"])
log = structlog.get_logger(__name__)


@router.get("", summary="Health check")
async def health() -> JSONResponse:
    result: dict[str, Any] = {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }

    db_ok = await check_db_health()
    result["db"] = "healthy" if db_ok else "unreachable"
    if not db_ok:
        result["status"] = "degraded"

    redis_ok = await check_redis_health()
    result["redis"] = "healthy" if redis_ok else "unreachable"
    if not redis_ok:
        result["status"] = "degraded"

    # Always 200 — Railway health check must see 2xx regardless of dependency state
    return JSONResponse(status_code=200, content=result)


@router.get("/full", summary="Full dependency health check")
async def full_health() -> JSONResponse:
    result: dict[str, Any] = {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }

    db_ok = await check_db_health()
    result["db"] = "healthy" if db_ok else "unreachable"
    if not db_ok:
        result["status"] = "degraded"

    redis_ok = await check_redis_health()
    result["redis"] = "healthy" if redis_ok else "unreachable"
    if not redis_ok:
        result["status"] = "degraded"

    return JSONResponse(status_code=200, content=result)


@router.get("/workers", summary="Celery worker queue diagnostics")
async def workers_health() -> dict[str, Any]:
    try:
        client = get_redis_client()
        depth: int = await client.llen("coach")
        last_session_id: Optional[str] = await client.get("coach:last_session_id")
        return {"coach_queue_depth": depth, "last_session_id": last_session_id}
    except Exception as exc:
        log.warning("Workers health check failed", error=str(exc))
        return {"coach_queue_depth": -1, "last_session_id": None}
