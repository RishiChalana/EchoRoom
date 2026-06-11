from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Literal, Optional, TypedDict

import instructor
import redis
import structlog
from langgraph.graph import END, StateGraph
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionFactory
from app.models.agent_event import AgentEvent
from app.models.session import Session
from app.models.session_report import SessionReport
from app.schemas.events import CoachInsight, RewriteSuggestion

log = structlog.get_logger(__name__)

_SEG_PROMPT = (Path(__file__).parent.parent / "prompts" / "coach_segment.txt").read_text
_INS_PROMPT = (Path(__file__).parent.parent / "prompts" / "coach_insights.txt").read_text
_REW_PROMPT = (Path(__file__).parent.parent / "prompts" / "coach_rewrite.txt").read_text


class _SegmentClassification(BaseModel):
    chunk_id: str
    classification: Literal["strong", "weak", "critical"]
    reason: str


class _SegmentClassificationList(BaseModel):
    segments: List[_SegmentClassification]


class CoachState(TypedDict):
    session_id: str
    events: List[dict]
    segment_classifications: List[dict]
    insights: List[CoachInsight]
    rewrites: List[RewriteSuggestion]
    summary: Optional[str]
    overall_score: Optional[float]
    engagement_avg: Optional[float]
    clarity_avg: Optional[float]


class CoachAgent:
    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._client = instructor.from_openai(AsyncOpenAI(api_key=settings.OPENAI_API_KEY))
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
        async with AsyncSessionFactory() as db:
            result = await db.execute(
                select(AgentEvent)
                .where(AgentEvent.session_id == state["session_id"])
                .order_by(AgentEvent.created_at)
            )
            events = result.scalars().all()

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
        clarity_scores = [
            e.payload.get("score", 0.0)
            for e in events
            if e.agent_name == "clarity_analyzer"
        ]

        return {
            **state,
            "events": serialized,
            "engagement_avg": (
                round(sum(engagement_scores) / len(engagement_scores), 4)
                if engagement_scores
                else None
            ),
            "clarity_avg": (
                round(sum(clarity_scores) / len(clarity_scores), 4)
                if clarity_scores
                else None
            ),
        }

    async def _segment_analyzer_node(self, state: CoachState) -> CoachState:
        transcript_events = [e for e in state["events"] if e["agent_name"] == "transcript"]
        if not transcript_events:
            return {**state, "segment_classifications": []}

        context = json.dumps(transcript_events[:50], indent=2)
        response: _SegmentClassificationList = await self._client.chat.completions.create(
            model="gpt-4o-mini",
            response_model=_SegmentClassificationList,
            messages=[
                {"role": "system", "content": _SEG_PROMPT()},
                {"role": "user", "content": f"Transcript segments:\n{context}"},
            ],
            max_retries=2,
        )
        return {**state, "segment_classifications": [s.model_dump() for s in response.segments]}

    async def _insight_synthesizer_node(self, state: CoachState) -> CoachState:
        classifications = state.get("segment_classifications", [])
        critical_count = sum(1 for s in classifications if s.get("classification") == "critical")
        strong_count = sum(1 for s in classifications if s.get("classification") == "strong")
        total = len(classifications) or 1

        context = {
            "engagement_avg": state.get("engagement_avg"),
            "clarity_avg": state.get("clarity_avg"),
            "segment_classifications": classifications,
            "event_count": len(state.get("events", [])),
        }

        insights: List[CoachInsight] = await self._client.chat.completions.create(
            model="gpt-4o",
            response_model=List[CoachInsight],
            messages=[
                {"role": "system", "content": _INS_PROMPT()},
                {"role": "user", "content": json.dumps(context)},
            ],
            max_retries=2,
        )

        eng = state.get("engagement_avg") or 0.5
        clar = state.get("clarity_avg") or 0.5
        base = (eng + clar) / 2 * 8
        bonus = (strong_count / total) * 2
        penalty = (critical_count / total) * 3
        overall_score = round(max(0.0, min(10.0, base + bonus - penalty)), 2)

        return {**state, "insights": insights, "overall_score": overall_score}

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

        for seg in weak_chunks:
            event = events_by_chunk.get(seg["chunk_id"])
            if not event:
                continue
            original_text: str = event.get("payload", {}).get("text", "")
            if not original_text:
                continue

            rewrite: RewriteSuggestion = await self._client.chat.completions.create(
                model="gpt-4o-mini",
                response_model=RewriteSuggestion,
                messages=[
                    {"role": "system", "content": _REW_PROMPT()},
                    {"role": "user", "content": f"Original passage:\n{original_text}"},
                ],
                max_retries=2,
            )
            rewrites.append(rewrite)

        return {**state, "rewrites": rewrites}

    async def _save_report_node(self, state: CoachState) -> CoachState:
        insights_data = [i.model_dump() for i in state.get("insights", [])]
        rewrites_data = [r.model_dump() for r in state.get("rewrites", [])]
        summary = " ".join(i["text"] for i in insights_data[:2]) if insights_data else "Session complete."

        async with AsyncSessionFactory() as db:
            report = SessionReport(
                session_id=state["session_id"],
                overall_score=state.get("overall_score"),
                engagement_avg=state.get("engagement_avg"),
                clarity_avg=state.get("clarity_avg"),
                insights=insights_data,
                rewrites=rewrites_data,
                summary=summary,
                coach_model="gpt-4o",
            )
            db.add(report)

            result = await db.execute(
                select(Session).where(Session.id == state["session_id"])
            )
            session = result.scalar_one_or_none()
            if session:
                session.status = "complete"
                session.overall_score = state.get("overall_score")
                session.report_ready = True

            await db.commit()

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
            "events": [],
            "segment_classifications": [],
            "insights": [],
            "rewrites": [],
            "summary": None,
            "overall_score": None,
            "engagement_avg": None,
            "clarity_avg": None,
        }
        result = await self._graph.ainvoke(initial_state)
        return {
            "session_id": result["session_id"],
            "overall_score": result.get("overall_score"),
            "insights_count": len(result.get("insights", [])),
            "rewrites_count": len(result.get("rewrites", [])),
        }
