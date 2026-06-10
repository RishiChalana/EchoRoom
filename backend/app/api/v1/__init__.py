from fastapi import APIRouter
from app.api.v1.health import router as health_router

# ── V1 Router ─────────────────────────────────────────────────────────────────
v1_router = APIRouter(prefix="/v1")
v1_router.include_router(health_router)

# ── Future routers (add here as agents are built) ─────────────────────────────
# from app.api.v1.sessions import router as sessions_router   # Week 1
# from app.api.v1.stream import router as stream_router       # Week 4
# from app.api.v1.reports import router as reports_router     # Week 7
# from app.api.v1.eval import router as eval_router           # Week 8
