from __future__ import annotations

import base64
import tempfile
from pathlib import Path
from typing import Optional

import redis
import structlog

from app.agents._persist import persist_event
from app.core.config import settings
from app.schemas.events import TranscriptChunk, WordToken

log = structlog.get_logger(__name__)

_model: Optional[object] = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel  # noqa: PLC0415

        _model = WhisperModel("base", device="cpu", compute_type="int8")
    return _model


def run_transcription(session_id: str, chunk_id: str, audio_b64: str) -> TranscriptChunk:
    model = _get_model()
    raw = base64.b64decode(audio_b64)

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
        f.write(raw)
        tmp_path = f.name

    try:
        segments, info = model.transcribe(tmp_path, word_timestamps=True, vad_filter=True)

        text_parts: list[str] = []
        words: list[WordToken] = []
        avg_logprob: float = 0.0
        no_speech_prob: float = 0.0

        for segment in segments:
            text_parts.append(segment.text.strip())
            avg_logprob = segment.avg_logprob
            no_speech_prob = segment.no_speech_prob
            if segment.words:
                for w in segment.words:
                    words.append(
                        WordToken(word=w.word, start=w.start, end=w.end, probability=w.probability)
                    )

        chunk = TranscriptChunk(
            chunk_id=chunk_id,
            session_id=session_id,
            text=" ".join(text_parts),
            words=words,
            language=info.language,
            avg_logprob=avg_logprob,
            no_speech_prob=no_speech_prob,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    r = redis.from_url(settings.REDIS_URL)
    try:
        r.publish(f"transcript:{session_id}", chunk.model_dump_json())
    finally:
        r.close()

    persist_event(
        session_id,
        chunk_id,
        agent_name="transcript",
        event_type="transcript_chunk",
        payload={
            "text": chunk.text,
            "language": chunk.language,
            "no_speech_prob": chunk.no_speech_prob,
        },
    )

    log.info("Transcript published", session_id=session_id, chunk_id=chunk_id, text_len=len(chunk.text))
    return chunk