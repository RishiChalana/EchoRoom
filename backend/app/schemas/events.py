from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel


class WordToken(BaseModel):
    word: str
    start: float
    end: float
    probability: float


class TranscriptChunk(BaseModel):
    chunk_id: str
    session_id: str
    text: str
    words: List[WordToken]
    language: str
    avg_logprob: float
    no_speech_prob: float


class EngagementSignal(BaseModel):
    chunk_id: str
    session_id: str
    score: float
    label: Literal["low", "medium", "high"]
    features: Dict[str, float]


class ClarityIssue(BaseModel):
    issue_type: Literal["jargon", "filler", "passive", "ambiguous"]
    text: str
    suggestion: str


class ClarityAnalysis(BaseModel):
    chunk_id: str
    session_id: str
    score: float
    issues: List[ClarityIssue]


class SessionStateUpdate(BaseModel):
    session_id: str
    engagement_avg: Optional[float] = None
    clarity_avg: Optional[float] = None
    latest_transcript: Optional[str] = None


class CoachInsight(BaseModel):
    category: Literal["strength", "improvement", "critical"]
    text: str
    evidence: str


class RewriteSuggestion(BaseModel):
    original: str
    improved: str
    reason: str
