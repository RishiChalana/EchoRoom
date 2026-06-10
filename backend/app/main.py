from __future__ import annotations

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.redis import init_redis, close_redis
from app.core.database import engine
from app.api.router import api_router

log = structlog.get_logger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manage startup and shutdown of all application resources."""

    # ── Startup ──────────────────────────────────────────────────────────────
    setup_logging()
    log.info(
        "EchoRoom API starting",
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )

    await init_redis()
    log.info("Redis ready")

    log.info("EchoRoom API ready", host=settings.HOST, port=settings.PORT)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    log.info("EchoRoom API shutting down")
    await close_redis()
    await engine.dispose()
    log.info("Shutdown complete")


# ── App Factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "EchoRoom — Agentic Communication Intelligence Platform.\n\n"
            "Real-time multi-agent speech analysis system."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    # ── Routes ────────────────────────────────────────────────────────────────
    app.include_router(api_router)

    return app


# ── Application Instance ──────────────────────────────────────────────────────
app = create_app()
