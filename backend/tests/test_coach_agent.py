"""Coach agent and clarity agent fallback tests.

All LLM calls are mocked — no network I/O, no API key needed.
The clarity agent _call_gemini helper is patched directly to bypass the
tenacity retry delays (min=2s per attempt × 3 attempts = slow tests otherwise).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.clarity_agent import analyze_transcript_clarity
from app.agents.coach_agent import CoachAgent, CoachState


# ── Clarity agent fallback ─────────────────────────────────────────────────────


def test_clarity_empty_text_returns_perfect_score() -> None:
    result = analyze_transcript_clarity("session-1", "", "general")
    assert result["score"] == 1.0
    assert result["issues"] == []
    assert "error" not in result


def test_clarity_whitespace_only_treated_as_empty() -> None:
    result = analyze_transcript_clarity("session-1", "   \n  ", "general")
    assert result["score"] == 1.0


def test_clarity_auth_error_categorized_correctly() -> None:
    with patch("app.agents.clarity_agent._call_gemini",
               side_effect=Exception("401 Unauthorized: Invalid API key")):
        result = analyze_transcript_clarity("session-1", "Hello world test.", "general")

    assert result["score"] is None
    assert result["issues"] == []
    assert "authentication failed" in result["error"].lower()


def test_clarity_rate_limit_error_categorized_correctly() -> None:
    with patch("app.agents.clarity_agent._call_gemini",
               side_effect=Exception("429 Too Many Requests")):
        result = analyze_transcript_clarity("session-1", "Hello world test.", "general")

    assert result["score"] is None
    assert "rate limited" in result["error"].lower()


def test_clarity_timeout_error_categorized_correctly() -> None:
    with patch("app.agents.clarity_agent._call_gemini",
               side_effect=Exception("Request timeout exceeded")):
        result = analyze_transcript_clarity("session-1", "Hello world test.", "general")

    assert result["score"] is None
    assert "timed out" in result["error"].lower()


def test_clarity_generic_error_includes_exception_type() -> None:
    with patch("app.agents.clarity_agent._call_gemini",
               side_effect=ValueError("Some unexpected problem")):
        result = analyze_transcript_clarity("session-1", "Hello world test.", "general")

    assert result["score"] is None
    assert "ValueError" in result["error"]


# ── Coach agent insight synthesizer fallback ───────────────────────────────────


async def test_insight_synthesizer_falls_back_when_llm_fails() -> None:
    with patch("app.agents.coach_agent.AsyncOpenAI"), \
         patch("app.agents.coach_agent.instructor.from_openai") as mock_from_openai:
        mock_llm = MagicMock()
        mock_llm.chat.completions.create = AsyncMock(
            side_effect=Exception("Simulated Gemini API failure")
        )
        mock_from_openai.return_value = mock_llm
        agent = CoachAgent("test-session-id")

    state: CoachState = {
        "session_id": "test-session-id",
        "audience_profile": "general",
        "events": [],
        "segment_classifications": [
            {"chunk_id": "c1", "classification": "weak", "reason": "test"},
        ],
        "insights": [],
        "rewrites": [],
        "summary": None,
        "overall_score": None,
        "engagement_avg": 0.6,
        "clarity_avg": None,
        "clarity_issues": [],
        "clarity_error": "AI provider authentication failed.",
        "wpm": None,
    }

    result = await agent._insight_synthesizer_node(state)

    assert len(result["insights"]) >= 2
    assert result["overall_score"] is not None

    clarity_insight = next(
        (i for i in result["insights"] if "Clarity" in i.text),
        None,
    )
    assert clarity_insight is not None
    assert "authentication failed" in clarity_insight.evidence


async def test_fallback_insights_engagement_strength() -> None:
    with patch("app.agents.coach_agent.AsyncOpenAI"), \
         patch("app.agents.coach_agent.instructor.from_openai"):
        agent = CoachAgent("s")

    state: CoachState = {
        "session_id": "s",
        "audience_profile": "general",
        "events": [],
        "segment_classifications": [],
        "insights": [],
        "rewrites": [],
        "summary": None,
        "overall_score": None,
        "engagement_avg": 0.8,
        "clarity_avg": None,
        "clarity_issues": [],
        "clarity_error": None,
        "wpm": None,
    }
    insights = agent._fallback_insights(state)

    engagement_insight = insights[0]
    assert engagement_insight.category == "strength"
    assert "0.8" in engagement_insight.evidence


async def test_fallback_insights_no_engagement_signal() -> None:
    with patch("app.agents.coach_agent.AsyncOpenAI"), \
         patch("app.agents.coach_agent.instructor.from_openai"):
        agent = CoachAgent("s")

    state: CoachState = {
        "session_id": "s",
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
    }
    insights = agent._fallback_insights(state)

    assert any("No engagement signal" in i.evidence for i in insights)


async def test_overall_score_computed_without_llm() -> None:
    """Overall score is always deterministic — LLM success/failure should not affect it."""
    with patch("app.agents.coach_agent.AsyncOpenAI"), \
         patch("app.agents.coach_agent.instructor.from_openai") as mock_from_openai:
        mock_llm = MagicMock()
        mock_llm.chat.completions.create = AsyncMock(
            side_effect=Exception("LLM down")
        )
        mock_from_openai.return_value = mock_llm
        agent = CoachAgent("s")

    state: CoachState = {
        "session_id": "s",
        "audience_profile": "general",
        "events": [],
        "segment_classifications": [
            {"chunk_id": "c1", "classification": "strong", "reason": "good"},
            {"chunk_id": "c2", "classification": "critical", "reason": "bad"},
        ],
        "insights": [],
        "rewrites": [],
        "summary": None,
        "overall_score": None,
        "engagement_avg": 0.7,
        "clarity_avg": 0.6,
        "clarity_issues": [],
        "clarity_error": None,
        "wpm": None,
    }
    result = await agent._insight_synthesizer_node(state)

    score = result["overall_score"]
    assert score is not None
    assert 0.0 <= score <= 10.0
