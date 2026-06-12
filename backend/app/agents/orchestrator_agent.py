from __future__ import annotations

import asyncio
import json
from typing import Optional

import redis.asyncio
import structlog

from app.core.config import settings
from app.schemas.events import ClarityAnalysis, EngagementSignal, SessionStateUpdate, TranscriptChunk

log = structlog.get_logger(__name__)


class OrchestratorAgent:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._engagement_scores: list[float] = []
        self._clarity_scores: list[float] = []
        self._latest_transcript: Optional[str] = None

    async def run_for_session(self) -> None:
        r = redis.asyncio.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(
            f"transcript:{self.session_id}",
            f"engagement:{self.session_id}",
            f"clarity:{self.session_id}",
        )
        log.info("Orchestrator subscribed", session_id=self.session_id)

        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                channel: str = message["channel"]
                data = json.loads(message["data"])
                await self._handle_message(channel, data, r)
        finally:
            await pubsub.unsubscribe()
            await r.aclose()

    async def _handle_message(self, channel: str, data: dict, r) -> None:
        if channel.startswith("transcript:"):
            chunk = TranscriptChunk.model_validate(data)
            self._latest_transcript = chunk.text
        elif channel.startswith("engagement:"):
            signal = EngagementSignal.model_validate(data)
            self._engagement_scores.append(signal.score)
        elif channel.startswith("clarity:"):
            analysis = ClarityAnalysis.model_validate(data)
            self._clarity_scores.append(analysis.score)

        update = SessionStateUpdate(
            session_id=self.session_id,
            engagement_avg=(
                round(sum(self._engagement_scores) / len(self._engagement_scores), 4)
                if self._engagement_scores
                else None
            ),
            clarity_avg=(
                round(sum(self._clarity_scores) / len(self._clarity_scores), 4)
                if self._clarity_scores
                else None
            ),
            latest_transcript=self._latest_transcript,
        )
        await r.publish(f"state:{self.session_id}", update.model_dump_json())
        log.debug("State update published", session_id=self.session_id)
