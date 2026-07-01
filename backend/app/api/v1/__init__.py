from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.sessions import router as sessions_router
from app.api.v1.stream import router as stream_router
from app.api.v1.reports import router as reports_router
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router

# ── V1 Router ─────────────────────────────────────────────────────────────────
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(health_router)
v1_router.include_router(sessions_router)
v1_router.include_router(stream_router)
v1_router.include_router(reports_router)
v1_router.include_router(auth_router)
v1_router.include_router(users_router)
