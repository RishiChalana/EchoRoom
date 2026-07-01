from __future__ import annotations

import asyncio
import base64
import time
import uuid
from typing import Optional
from uuid import UUID

import redis.asyncio
import structlog
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.orchestrator_agent import OrchestratorAgent
from app.core.auth import get_current_user_optional
from app.core.config import settings
from app.core.database import get_db
from app.core.redis import get_redis_client
from app.models.session import Session

router = APIRouter(prefix="/ws", tags=["stream"])
log = structlog.get_logger(__name__)

# Only the aggregated state and report-ready signals are forwarded to the browser.
# Raw transcript/engagement/clarity messages have different shapes and stay
# server-side; the orchestrator subscribes to them and republishes to `state:`.
_SUB_CHANNELS = ["state", "report_ready"]

_FLUSH_BYTES = 48_000          # ~3s of webm/opus at 128kbps
_FLUSH_SECONDS = 3.0


async def _check_websocket_rate_limit(identifier: str) -> bool:
    """
    Allows max 5 new WebSocket connections per session per 60 seconds.
    Returns True if the connection is allowed, False if rate limited.
    Fails open on Redis errors so a Redis outage doesn't block all connections.
    """
    try:
        client = get_redis_client()
        key = f"ws_rate_limit:{identifier}"
        count = await client.incr(key)
        if count == 1:
            await client.expire(key, 60)
        return count <= 5
    except Exception:
        return True


def _dispatch(session_id: str, chunk_id: str, audio_b64: str) -> None:
    """Blocking Celery dispatch — must run via asyncio.to_thread to keep
    Kombu's synchronous socket I/O off the event loop."""
    from app.workers.tasks import transcribe_chunk  # noqa: PLC0415

    transcribe_chunk.apply_async(
        args=[session_id, chunk_id, audio_b64],
        queue="local",
    )


@router.websocket("/{session_id}")
async def audio_stream(
    websocket: WebSocket,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
) -> None:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session or session.status != "active":
        await websocket.close(code=4004, reason="Session not found or not active")
        return
    if session.user_email and current_user:
        if session.user_email != current_user.get("email"):
            await websocket.close(code=4003, reason="Not your session")
            return

    if not await _check_websocket_rate_limit(str(session_id)):
        await websocket.close(code=1008, reason="Rate limit exceeded")
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

    # Start the orchestrator for this session — it subscribes to the raw
    # transcript/engagement/clarity channels and republishes the aggregate to `state:`.
    orchestrator = OrchestratorAgent(str(session_id))
    orchestrator_task = asyncio.create_task(orchestrator.run_for_session())

    # webm fragment buffering: the FIRST fragment from MediaRecorder carries the
    # EBML/webm header. Fragments 1+ are headerless cluster continuations and are
    # NOT independently decodable. We store the header once, then every flush
    # dispatches header + accumulated-clusters as ONE valid standalone webm blob.
    header_bytes = b""
    buffer = bytearray()
    last_flush = time.monotonic()

    # Accumulate ALL raw chunks for session-level audio storage (7B-alt path).
    # audio_data is NOT stored in agent_events (transcript_agent only persists
    # text), so we buffer the full WebM stream here and write it to Redis at
    # disconnect. The coach pipeline reads from Redis and persists to
    # session_reports.audio_data at report-save time.
    audio_chunks: list[bytes] = []

    async def _flush() -> None:
        nonlocal buffer, last_flush
        if not buffer or not header_bytes:
            return
        blob = header_bytes + bytes(buffer)
        chunk_id = str(uuid.uuid4())
        audio_b64 = base64.b64encode(blob).decode()
        buffer = bytearray()
        last_flush = time.monotonic()
        try:
            await asyncio.to_thread(_dispatch, str(session_id), chunk_id, audio_b64)
        except Exception as exc:
            log.warning("Failed to dispatch transcribe task", error=str(exc))

    try:
        while True:
            raw = await websocket.receive_bytes()
            audio_chunks.append(raw)  # always accumulate before header check

            if not header_bytes:
                header_bytes = raw
                continue

            buffer.extend(raw)

            if len(buffer) >= _FLUSH_BYTES or (time.monotonic() - last_flush) >= _FLUSH_SECONDS:
                await _flush()
    except WebSocketDisconnect:
        log.info("WebSocket disconnected", session_id=str(session_id))
        await _flush()
        if audio_chunks:
            try:
                full_audio = b"".join(audio_chunks)
                await r.set(f"audio:{session_id}", full_audio, ex=3600)
                log.info(
                    "Session audio stored in Redis",
                    session_id=str(session_id),
                    bytes=len(full_audio),
                )
            except Exception as exc:
                log.warning("Failed to store session audio in Redis", error=str(exc))
    finally:
        reader_task.cancel()
        orchestrator_task.cancel()
        try:
            await orchestrator_task
        except asyncio.CancelledError:
            pass
        await pubsub.unsubscribe()
        await r.aclose()