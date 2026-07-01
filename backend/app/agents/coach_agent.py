from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, List, Literal, Optional, TypedDict

import instructor
import redis
import sentry_sdk
import structlog
from langgraph.graph import END, StateGraph
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select

from app.agents.clarity_agent import analyze_transcript_clarity
from app.core.config import settings
from app.core.database import SyncSessionFactory
from app.models.agent_event import AgentEvent
from app.models.session import Session
from app.models.session_report import SessionReport
from app.schemas.events import CoachInsight, RewriteSuggestion

log = structlog.get_logger(__name__)

# Gemini's OpenAI-compatible endpoint — the trailing slash is REQUIRED.
_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
_MODEL = "gemini-2.5-flash"

_SEG_PROMPT = (Path(__file__).parent.parent / "prompts" / "coach_segment.txt").read_text
_INS_PROMPT = (Path(__file__).parent.parent / "prompts" / "coach_insights.txt").read_text
_REW_PROMPT = (Path(__file__).parent.parent / "prompts" / "coach_rewrite.txt").read_text


def _room_context(profile: str) -> str:
    contexts = {
        "technical": """
ROOM CONTEXT: Technical Presentation
The speaker is explaining complex engineering or technical concepts.
Evaluate for: precise vocabulary, logical structure, avoiding jargon
without explanation, clear transitions between technical concepts,
appropriate pacing for dense information. A "strength" here is
technical precision and clarity under complexity. A "critical" issue
is undefined acronyms, unclear architecture explanations, or loss of
audience thread. Rewrites should preserve technical accuracy while
improving clarity.
""",
        "interview": """
ROOM CONTEXT: Professional Interview
The speaker is in a high-stakes evaluative conversation.
Evaluate for: concise direct answers (no rambling), structured
responses (situation → action → result), confident but not arrogant
tone, avoiding filler words that signal nervousness, specific examples
over generalities. A "strength" is structured confident delivery.
A "critical" issue is vague answers, excessive hedging, or trailing
off without conclusion. Rewrites should make answers crisper and
more confident.
""",
        "presentation": """
ROOM CONTEXT: Public Presentation / Stage
The speaker is presenting to a room or large audience.
Evaluate for: narrative arc and storytelling, strong opening hook,
clear takeaway per section, vocal variety and pacing for emphasis,
deliberate pauses at key moments, audience engagement language
("imagine", "consider", "here's what this means for you").
A "strength" is commanding presence and clear narrative. A "critical"
issue is flat delivery, unclear structure, or losing the thread.
Rewrites should add narrative punch and audience connection.
""",
        "general": """
ROOM CONTEXT: General Communication
The speaker is practicing everyday professional communication.
Evaluate for: clarity of thought, natural conversational flow,
appropriate vocabulary for the context, listening and responding
(not just broadcasting), warm but professional tone.
A "strength" is natural engaging communication. A "critical" issue
is confusing structure or disconnected thoughts. Rewrites should
make communication feel more natural and purposeful.
""",
    }
    return contexts.get(profile, contexts["general"])


class _SegmentClassification(BaseModel):
    chunk_id: str
    classification: Literal["strong", "weak", "critical"]
    reason: str


class _SegmentClassificationList(BaseModel):
    segments: List[_SegmentClassification]


class CoachState(TypedDict):
    session_id: str
    audience_profile: str
    events: List[dict]
    segment_classifications: List[dict]
    insights: List[CoachInsight]
    rewrites: List[RewriteSuggestion]
    summary: Optional[str]
    overall_score: Optional[float]
    engagement_avg: Optional[float]
    clarity_avg: Optional[float]
    clarity_issues: List[dict]
    clarity_error: Optional[str]
    wpm: Optional[int]
    audio_data: Optional[bytes]
    audio_content_type: str


class CoachAgent:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._client = instructor.from_openai(
            AsyncOpenAI(
                api_key=settings.GEMINI_API_KEY,
                base_url=_BASE_URL,
                timeout=30.0,  # a hung backoff must not stall the whole pipeline
            ),
            mode=instructor.Mode.JSON,
        )
        self._graph = self._build_graph()

    def _build_graph(self) -> Any:
        g: StateGraph = StateGraph(CoachState)
        g.add_node("fetch_events", self._fetch_events_node)
        g.add_node("segment_analyzer", self._segment_analyzer_node)
        g.add_node("insight_synthesizer", self._insight_synthesizer_node)
        g.add_node("rewrite_generator", self._rewrite_generator_node)
        g.add_node("save_report", self._save_report_node)
        g.set_entry_point("fetch_events")
        g.add_edge("fetch_events", "segment_analyzer")
        g.add_edge("segment_analyzer", "insight_synthesizer")
        g.add_edge("insight_synthesizer", "rewrite_generator")
        g.add_edge("rewrite_generator", "save_report")
        g.add_edge("save_report", END)
        return g.compile()

    async def _fetch_events_node(self, state: CoachState) -> CoachState:
        # Sync DB access — psycopg2 is not loop-bound, so it is safe to reuse the
        # pooled connection across Celery tasks (unlike the loop-bound asyncpg pool).
        with SyncSessionFactory() as db:
            result = db.execute(
                select(AgentEvent)
                .where(AgentEvent.session_id == state["session_id"])
                .order_by(AgentEvent.created_at)
            )
            events = result.scalars().all()

            session_result = db.execute(
                select(Session).where(Session.id == state["session_id"])
            )
            session_row = session_result.scalar_one_or_none()
            duration_seconds = session_row.duration_seconds if session_row else None
            audience_profile = (session_row.audience_profile if session_row else None) or "general"

        serialized = [
            {
                "event_id": str(e.event_id),
                "agent_name": e.agent_name,
                "event_type": e.event_type,
                "payload": e.payload,
                "chunk_id": e.chunk_id,
            }
            for e in events
        ]

        engagement_scores = [
            e.payload.get("score", 0.0)
            for e in events
            if e.agent_name == "engagement_classifier"
        ]

        # Clarity is computed ONCE here over the whole transcript (one LLM call)
        # rather than per-chunk in real time, which 429s on the free tier. The
        # transcript chunks are already ordered by created_at from the query above.
        full_text = " ".join(
            str(e.payload.get("text", "")).strip()
            for e in events
            if e.agent_name == "transcript" and e.payload.get("text")
        ).strip()
        clarity_result = await asyncio.to_thread(
            analyze_transcript_clarity, state["session_id"], full_text, audience_profile
        )

        total_words = sum(
            len(str(e.payload.get("text", "")).split())
            for e in events
            if e.agent_name == "transcript" and e.payload.get("text")
        )
        wpm = (
            round((total_words / duration_seconds) * 60)
            if duration_seconds and duration_seconds > 0
            else None
        )

        return {
            **state,
            "audience_profile": audience_profile,
            "events": serialized,
            "engagement_avg": (
                round(sum(engagement_scores) / len(engagement_scores), 4)
                if engagement_scores
                else None
            ),
            "clarity_avg": clarity_result.get("score"),
            "clarity_issues": clarity_result.get("issues", []),
            "clarity_error": clarity_result.get("error"),
            "wpm": wpm,
        }

    async def _segment_analyzer_node(self, state: CoachState) -> CoachState:
        transcript_events = [e for e in state["events"] if e["agent_name"] == "transcript"]
        if not transcript_events:
            return {**state, "segment_classifications": []}

        context = json.dumps(transcript_events[:50], indent=2)
        room_ctx = _room_context(state.get("audience_profile", "general"))
        try:
            response: _SegmentClassificationList = await self._client.chat.completions.create(
                model=_MODEL,
                response_model=_SegmentClassificationList,
                messages=[
                    {"role": "system", "content": _SEG_PROMPT()},
                    {"role": "user", "content": f"Room context:\n{room_ctx}\n\nTranscript segments:\n{context}"},
                ],
                max_retries=1,
            )
            classifications = [s.model_dump() for s in response.segments]
        except Exception as exc:
            log.warning("coach node fell back to heuristic", node="segment_analyzer", error=str(exc))
            sentry_sdk.capture_message(
                f"Coach pipeline fallback triggered: segment_analyzer — {type(exc).__name__}",
                level="warning",
            )
            classifications = self._fallback_segments(state, transcript_events)
        return {**state, "segment_classifications": classifications}

    def _fallback_segments(
        self, state: CoachState, transcript_events: list[dict]
    ) -> list[dict]:
        """Deterministic per-chunk classification when the LLM is unavailable."""
        eng_by_chunk: dict[str, float] = {
            e["chunk_id"]: e["payload"].get("score", 0.0)
            for e in state.get("events", [])
            if e["agent_name"] == "engagement_classifier" and e.get("chunk_id")
        }
        out: list[dict] = []
        for e in transcript_events:
            chunk_id = e.get("chunk_id") or ""
            score = eng_by_chunk.get(chunk_id)
            if score is None:
                classification = "weak"
            elif score >= 0.66:
                classification = "strong"
            elif score >= 0.4:
                classification = "weak"
            else:
                classification = "critical"
            out.append(
                {
                    "chunk_id": chunk_id,
                    "classification": classification,
                    "reason": "Heuristic classification (LLM unavailable).",
                }
            )
        return out

    async def _insight_synthesizer_node(self, state: CoachState) -> CoachState:
        classifications = state.get("segment_classifications", [])
        critical_count = sum(1 for s in classifications if s.get("classification") == "critical")
        strong_count = sum(1 for s in classifications if s.get("classification") == "strong")
        total = len(classifications) or 1

        # Deterministic overall score — always computed, independent of the LLM.
        eng = state.get("engagement_avg") or 0.5
        clar = state.get("clarity_avg") or 0.5
        base = (eng + clar) / 2 * 8
        bonus = (strong_count / total) * 2
        penalty = (critical_count / total) * 3
        overall_score = round(max(0.0, min(10.0, base + bonus - penalty)), 2)

        context = {
            "engagement_avg": state.get("engagement_avg"),
            "clarity_avg": state.get("clarity_avg"),
            "segment_classifications": classifications,
            "event_count": len(state.get("events", [])),
        }

        ins_system = _INS_PROMPT() + "\n\n" + _room_context(state.get("audience_profile", "general"))
        try:
            insights: List[CoachInsight] = await self._client.chat.completions.create(
                model=_MODEL,
                response_model=List[CoachInsight],
                messages=[
                    {"role": "system", "content": ins_system},
                    {"role": "user", "content": json.dumps(context)},
                ],
                max_retries=1,
            )
        except Exception as exc:
            log.warning("coach node fell back to heuristic", node="insight_synthesizer", error=str(exc))
            sentry_sdk.capture_message(
                f"Coach pipeline fallback triggered: insight_synthesizer — {type(exc).__name__}",
                level="warning",
            )
            insights = self._fallback_insights(state)

        # Surface the top clarity issue as one extra insight — only when the batch
        # clarity call actually succeeded (clarity_avg not None). Never fabricate
        # clarity insights on free-tier fallback.
        clarity_issues = state.get("clarity_issues", [])
        if state.get("clarity_avg") is not None and clarity_issues:
            top = clarity_issues[0]
            insights.append(
                CoachInsight(
                    category="improvement",
                    text=f"Clarity: address {top.get('issue_type', 'an issue')}",
                    evidence=f"\"{top.get('text', '')}\" — {top.get('suggestion', '')}".strip(),
                )
            )

        return {**state, "insights": insights, "overall_score": overall_score}

    def _fallback_insights(self, state: CoachState) -> List[CoachInsight]:
        """Three heuristic insights built from data we already have."""
        eng = state.get("engagement_avg")
        clar = state.get("clarity_avg")
        events = state.get("events", [])
        transcript_events = [e for e in events if e["agent_name"] == "transcript"]

        insights: List[CoachInsight] = []

        # 1) Engagement-based.
        if eng is not None and eng >= 0.6:
            insights.append(
                CoachInsight(
                    category="strength",
                    text="Strong audience engagement",
                    evidence=f"Average engagement score was {round(eng, 2)} across the session.",
                )
            )
        else:
            insights.append(
                CoachInsight(
                    category="improvement",
                    text="Engagement could be higher",
                    evidence=(
                        f"Average engagement score was {round(eng, 2)}."
                        if eng is not None
                        else "No engagement signal was captured this session."
                    ),
                )
            )

        # 2) Clarity-based, or a neutral note when clarity was unavailable.
        if clar is not None:
            insights.append(
                CoachInsight(
                    category="strength" if clar >= 0.6 else "improvement",
                    text="Clear delivery" if clar >= 0.6 else "Clarity has room to improve",
                    evidence=f"Average clarity score was {round(clar, 2)}.",
                )
            )
        else:
            clarity_error = state.get("clarity_error") or "The clarity analyzer produced no results."
            insights.append(
                CoachInsight(
                    category="improvement",
                    text="Clarity analysis was unavailable this session",
                    evidence=clarity_error,
                )
            )

        # 3) Pacing from transcript count / words-per-chunk.
        chunk_count = len(transcript_events)
        total_words = sum(
            len(str(e.get("payload", {}).get("text", "")).split()) for e in transcript_events
        )
        wpc = round(total_words / chunk_count, 1) if chunk_count else 0.0
        balanced = chunk_count > 0 and 5 <= wpc <= 60
        insights.append(
            CoachInsight(
                category="strength" if balanced else "improvement",
                text="Pacing overview",
                evidence=f"{chunk_count} transcript segments, ~{wpc} words per segment.",
            )
        )

        return insights

    async def _rewrite_generator_node(self, state: CoachState) -> CoachState:
        weak_chunks = [
            s
            for s in state.get("segment_classifications", [])
            if s.get("classification") in ("weak", "critical")
        ][:3]

        events_by_chunk: dict[str, dict] = {
            e["chunk_id"]: e for e in state.get("events", []) if e.get("chunk_id")
        }
        rewrites: List[RewriteSuggestion] = []

        rew_system = _REW_PROMPT() + "\n\n" + _room_context(state.get("audience_profile", "general"))
        try:
            for seg in weak_chunks:
                event = events_by_chunk.get(seg["chunk_id"])
                if not event:
                    continue
                original_text: str = event.get("payload", {}).get("text", "")
                if not original_text:
                    continue

                rewrite: RewriteSuggestion = await self._client.chat.completions.create(
                    model=_MODEL,
                    response_model=RewriteSuggestion,
                    messages=[
                        {"role": "system", "content": rew_system},
                        {"role": "user", "content": f"Original passage:\n{original_text}"},
                    ],
                    max_retries=1,
                )
                rewrites.append(rewrite)
        except Exception as exc:
            log.warning("coach node fell back to heuristic", node="rewrite_generator", error=str(exc))
            sentry_sdk.capture_message(
                f"Coach pipeline fallback triggered: rewrite_generator — {type(exc).__name__}",
                level="warning",
            )
            rewrites = []  # rewrites are genuinely optional

        return {**state, "rewrites": rewrites}

    async def _save_report_node(self, state: CoachState) -> CoachState:
        insights_data = [i.model_dump() for i in state.get("insights", [])]
        rewrites_data = [r.model_dump() for r in state.get("rewrites", [])]
        summary = (
            " ".join(i.get("text", "") for i in insights_data[:2])
            if insights_data
            else "Session complete."
        )

        # Always land a numeric score, even when both averages were null.
        overall_score = state.get("overall_score")
        if overall_score is None:
            overall_score = round(state.get("engagement_avg") or 0.5, 2) * 10
        state["overall_score"] = overall_score

        # Read session audio from Redis (stored by the WebSocket handler at disconnect).
        # By the time _save_report_node runs (after multiple LLM calls), the WS handler
        # has long since written the audio key. Delete it after reading to free memory.
        audio_data: Optional[bytes] = None
        r_sync = redis.from_url(settings.REDIS_URL)
        try:
            raw_audio = r_sync.get(f"audio:{state['session_id']}")
            if raw_audio:
                audio_data = bytes(raw_audio)
                r_sync.delete(f"audio:{state['session_id']}")
                log.info(
                    "Audio read from Redis",
                    session_id=state["session_id"],
                    bytes=len(audio_data),
                )
        except Exception as exc:
            log.warning("Failed to read audio from Redis", error=str(exc), session_id=state["session_id"])
        finally:
            r_sync.close()

        with SyncSessionFactory() as db:
            # Guard against the retry race: the task has max_retries=1, so a
            # second attempt after a partial failure would hit the UNIQUE
            # constraint on session_id. Skip the INSERT if a row already exists.
            existing = db.execute(
                select(SessionReport).where(SessionReport.session_id == state["session_id"])
            )
            if existing.scalar_one_or_none() is not None:
                log.warning(
                    "report already exists, skipping duplicate insert",
                    session_id=state["session_id"],
                )
            else:
                report = SessionReport(
                    session_id=state["session_id"],
                    overall_score=overall_score,
                    engagement_avg=state.get("engagement_avg"),
                    clarity_avg=state.get("clarity_avg"),
                    insights=insights_data,
                    rewrites=rewrites_data,
                    summary=summary,
                    coach_model=f"gemini-2.5-flash ({state.get('audience_profile', 'general')})",
                    wpm=state.get("wpm"),
                    audio_data=audio_data,
                    audio_content_type="audio/webm" if audio_data else None,
                )
                db.add(report)

            result = db.execute(
                select(Session).where(Session.id == state["session_id"])
            )
            session = result.scalar_one_or_none()
            if session:
                session.status = "complete"
                session.overall_score = overall_score
                session.report_ready = True

            db.commit()

        r = redis.from_url(settings.REDIS_URL)
        try:
            r.publish(
                f"report_ready:{state['session_id']}",
                json.dumps({"session_id": state["session_id"]}),
            )
        finally:
            r.close()

        log.info("Report saved", session_id=state["session_id"], score=state.get("overall_score"))
        return state

    async def run(self) -> dict:
        initial_state: CoachState = {
            "session_id": self.session_id,
            "audience_profile": "general",
            "events": [],
            "segment_classifications": [],
            "insights": [],
            "rewrites": [],
            "summary": None,
            "overall_score": None,
            "engagement_avg": None,
            "clarity_avg": None,
            "clarity_issues": [],
            "clarity_error": None,
            "wpm": None,
            "audio_data": None,
            "audio_content_type": "audio/webm",
        }
        try:
            result = await self._graph.ainvoke(initial_state)
            return {
                "session_id": result["session_id"],
                "overall_score": result.get("overall_score"),
                "insights_count": len(result.get("insights", [])),
                "rewrites_count": len(result.get("rewrites", [])),
            }
        except Exception as exc:
            # Even a catastrophic graph failure must not leave the session in
            # "processing" — save a minimal heuristic-only report.
            log.error(
                "Coach graph failed catastrophically, saving minimal report",
                session_id=self.session_id,
                error=str(exc),
            )
            sentry_sdk.capture_exception(exc)
            return await self._save_minimal_report()

    async def _save_minimal_report(self) -> dict:
        insights = [
            CoachInsight(
                category="improvement",
                text="Report generated from limited data",
                evidence="The coaching pipeline could not complete; a baseline report was produced.",
            )
        ]
        overall_score = 5.0

        with SyncSessionFactory() as db:
            existing = db.execute(
                select(SessionReport).where(SessionReport.session_id == self.session_id)
            )
            if existing.scalar_one_or_none() is None:
                db.add(
                    SessionReport(
                        session_id=self.session_id,
                        overall_score=overall_score,
                        engagement_avg=None,
                        clarity_avg=None,
                        insights=[i.model_dump() for i in insights],
                        rewrites=[],
                        summary="Session complete. Baseline report (coach pipeline error).",
                        coach_model="gemini-2.5-flash",
                    )
                )

            result = db.execute(select(Session).where(Session.id == self.session_id))
            session = result.scalar_one_or_none()
            if session:
                session.status = "complete"
                session.overall_score = overall_score
                session.report_ready = True

            db.commit()

        r = redis.from_url(settings.REDIS_URL)
        try:
            r.publish(
                f"report_ready:{self.session_id}",
                json.dumps({"session_id": self.session_id}),
            )
        finally:
            r.close()

        log.info("Minimal report saved", session_id=self.session_id, score=overall_score)
        return {
            "session_id": self.session_id,
            "overall_score": overall_score,
            "insights_count": len(insights),
            "rewrites_count": 0,
        }