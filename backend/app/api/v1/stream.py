from __future__ import annotations

import asyncio
import uuid
from uuid import UUID

import redis.asyncio
import structlog
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.session import Session

router = APIRouter(prefix="/ws", tags=["stream"])
log = structlog.get_logger(__name__)

_SUB_CHANNELS = ["transcript", "engagement", "clarity", "questions", "retention", "state", "report_ready"]


@router.websocket("/{session_id}")
async def audio_stream(
    websocket: WebSocket,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        await websocket.close(code=4004, reason="Session not found or not active")
        return

    await websocket.accept()
    log.info("WebSocket connected", session_id=str(session_id))

    r = redis.asyncio.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    channels = [f"{ch}:{session_id}" for ch in _SUB_CHANNELS]
    await pubsub.subscribe(*channels)

    async def _redis_reader() -> None:
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    text = data.decode() if isinstance(data, bytes) else data
                    await websocket.send_text(text)
        except asyncio.CancelledError:
            pass

    reader_task = asyncio.create_task(_redis_reader())

    try:
        while True:
            raw = await websocket.receive_bytes()
            chunk_id = str(uuid.uuid4())
            try:
                from app.workers.tasks import transcribe_chunk  # noqa: PLC0415

                transcribe_chunk.apply_async(
                    args=[str(session_id), chunk_id, list(raw)],
                    queue="local",
                )
            except Exception as exc:
                log.warning("Failed to dispatch transcribe task", error=str(exc))
    except WebSocketDisconnect:
        log.info("WebSocket disconnected", session_id=str(session_id))
    finally:
        reader_task.cancel()
        await pubsub.unsubscribe()
        await r.aclose()
