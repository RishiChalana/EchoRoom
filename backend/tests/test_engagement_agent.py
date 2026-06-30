"""Engagement agent tests.

_compute_features is a pure function — tested directly with no I/O.
classify_engagement calls Redis and persist_event — both mocked.
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.agents.engagement_agent import _compute_features, classify_engagement

FILLER_HEAVY = "um so like you know um uh basically um right okay so"
CLEAN = "The distributed system uses a message queue to decouple producers from consumers."


# ── _compute_features (pure) ────────────────────────────────────────────────────


def test_compute_features_empty_text_returns_zeros() -> None:
    f = _compute_features("")
    assert f["filler_ratio"] == 0.0
    assert f["type_token_ratio"] == 0.0
    assert f["avg_word_len"] == 0.0
    assert f["sentence_count"] == 0.0


def test_compute_features_filler_heavy_has_high_filler_ratio() -> None:
    f = _compute_features(FILLER_HEAVY)
    # Most words in FILLER_HEAVY are in the filler set
    assert f["filler_ratio"] > 0.5


def test_compute_features_clean_text_has_low_filler_ratio() -> None:
    f = _compute_features(CLEAN)
    assert f["filler_ratio"] == 0.0


def test_compute_features_type_token_ratio_bounded() -> None:
    f = _compute_features(CLEAN)
    assert 0.0 <= f["type_token_ratio"] <= 1.0


def test_compute_features_avg_word_len_positive_for_nonempty() -> None:
    f = _compute_features(CLEAN)
    assert f["avg_word_len"] > 0.0


def test_clean_text_scores_higher_than_filler_heavy() -> None:
    """Clean professional speech must beat filler-heavy speech on the scoring formula."""
    from app.agents.engagement_agent import classify_engagement as _ce

    def _score(text: str) -> float:
        mock_redis = MagicMock()
        with patch("app.agents.engagement_agent.redis.from_url", return_value=mock_redis), \
             patch("app.agents.engagement_agent.persist_event"):
            return _ce("s", "c", text).score

    assert _score(CLEAN) > _score(FILLER_HEAVY)


# ── classify_engagement (with mocked I/O) ─────────────────────────────────────


def test_classify_engagement_returns_signal() -> None:
    mock_redis = MagicMock()
    with patch("app.agents.engagement_agent.redis.from_url", return_value=mock_redis), \
         patch("app.agents.engagement_agent.persist_event"):
        signal = classify_engagement("session-1", "chunk-1", CLEAN)

    assert signal.session_id == "session-1"
    assert signal.chunk_id == "chunk-1"
    assert 0.0 <= signal.score <= 1.0
    assert signal.label in ("low", "medium", "high")
    mock_redis.publish.assert_called_once()
    mock_redis.close.assert_called_once()


def test_label_matches_score_thresholds() -> None:
    mock_redis = MagicMock()
    with patch("app.agents.engagement_agent.redis.from_url", return_value=mock_redis), \
         patch("app.agents.engagement_agent.persist_event"):
        clean_signal = classify_engagement("s", "c", CLEAN)
        filler_signal = classify_engagement("s", "c2", FILLER_HEAVY)

    # Clean speech should be high or medium; filler-heavy should be lower.
    if clean_signal.score >= 0.65:
        assert clean_signal.label == "high"
    elif clean_signal.score >= 0.35:
        assert clean_signal.label == "medium"
    else:
        assert clean_signal.label == "low"

    if filler_signal.score < 0.35:
        assert filler_signal.label == "low"
    elif filler_signal.score < 0.65:
        assert filler_signal.label == "medium"
    else:
        assert filler_signal.label == "high"


def test_score_is_bounded_between_0_and_1() -> None:
    mock_redis = MagicMock()
    for text in ["", FILLER_HEAVY, CLEAN, "a" * 500]:
        with patch("app.agents.engagement_agent.redis.from_url", return_value=mock_redis), \
             patch("app.agents.engagement_agent.persist_event"):
            signal = classify_engagement("s", "c", text)
        assert 0.0 <= signal.score <= 1.0
