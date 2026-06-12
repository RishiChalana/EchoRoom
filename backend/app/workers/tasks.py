from __future__ import annotations

import structlog

from app.workers.celery_app import celery_app

log = structlog.get_logger(__name__)


@celery_app.task(name="app.workers.tasks.transcribe_chunk", bind=True, max_retries=3)
def transcribe_chunk(self, session_id: str, chunk_id: str, audio_b64: str) -> dict:
    try:
        from app.agents.transcript_agent import run_transcription  # noqa: PLC0415

        chunk = run_transcription(session_id, chunk_id, audio_b64)

        # Chain: dispatch engagement only. Clarity is now a single whole-transcript
        # pass run by the coach agent at session end (per-chunk clarity 429'd on
        # the free tier). The analyze_clarity task remains defined below but is no
        # longer dispatched in the live chain.
        classify_engagement.apply_async(
            args=[session_id, chunk_id, chunk.text],
            queue="local",
        )

        log.info("Transcription complete, engagement dispatched", chunk_id=chunk_id)
        return chunk.model_dump()
    except Exception as exc:
        log.error("Transcription failed", chunk_id=chunk_id, error=str(exc))
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="app.workers.tasks.classify_engagement", bind=True, max_retries=3)
def classify_engagement(self, session_id: str, chunk_id: str, text: str) -> dict:
    try:
        from app.agents.engagement_agent import classify_engagement as _classify  # noqa: PLC0415

        signal = _classify(session_id, chunk_id, text)
        return signal.model_dump()
    except Exception as exc:
        log.error("Engagement classification failed", chunk_id=chunk_id, error=str(exc))
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="app.workers.tasks.analyze_clarity", bind=True, max_retries=3)
def analyze_clarity(self, session_id: str, chunk_id: str, text: str) -> dict:
    try:
        from app.agents.clarity_agent import analyze_clarity as _analyze  # noqa: PLC0415

        analysis = _analyze(session_id, chunk_id, text)
        return analysis.model_dump()
    except Exception as exc:
        log.error("Clarity analysis failed", chunk_id=chunk_id, error=str(exc))
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@celery_app.task(name="app.workers.tasks.process_coach_session", bind=True, max_retries=1)
def process_coach_session(self, session_id: str) -> dict:
    try:
        import asyncio  # noqa: PLC0415

        from app.agents.coach_agent import CoachAgent  # noqa: PLC0415

        agent = CoachAgent(session_id=session_id)
        result = asyncio.run(agent.run())
        log.info("Coach session complete", session_id=session_id)
        return result
    except Exception as exc:
        log.error("Coach agent failed", session_id=session_id, error=str(exc))
        raise self.retry(exc=exc, countdown=30)
