from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.models.session import Session
from app.models.agent_event import AgentEvent
from app.models.session_report import SessionReport


def test_session_can_be_instantiated_with_defaults():
    s = Session(status="active", audience_profile="general", report_ready=False)
    assert s.status == "active"
    assert s.audience_profile == "general"
    assert s.report_ready is False
    assert s.duration_seconds is None
    assert s.overall_score is None
    assert s.ended_at is None


def test_session_column_defaults_defined():
    table = Session.__table__
    assert table.c["status"].default.arg == "active"
    assert table.c["audience_profile"].default.arg == "general"
    assert table.c["report_ready"].default.arg is False


def test_session_repr():
    s = Session(status="active")
    assert "Session" in repr(s)
    assert "active" in repr(s)


def test_agent_event_requires_session_id():
    col = AgentEvent.__table__.c["session_id"]
    assert not col.nullable


def test_agent_event_payload_is_non_nullable():
    col = AgentEvent.__table__.c["payload"]
    assert not col.nullable


def test_agent_event_has_gin_index():
    index_names = {idx.name for idx in AgentEvent.__table__.indexes}
    assert "ix_agent_events_payload_gin" in index_names


def test_session_report_session_id_unique():
    col = SessionReport.__table__.c["session_id"]
    assert col.unique


def test_session_report_session_id_non_nullable():
    col = SessionReport.__table__.c["session_id"]
    assert not col.nullable


def test_session_report_insights_rewrites_defaults():
    table = SessionReport.__table__
    # Verify callable defaults exist (SQLAlchemy invokes them with execution context at INSERT time)
    assert callable(table.c["insights"].default.arg)
    assert callable(table.c["rewrites"].default.arg)
