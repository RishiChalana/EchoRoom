from __future__ import annotations

import uuid
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


class GeneratedQuestion(BaseModel):
    chunk_id: str
    session_id: str
    question: str
    rationale: str


class RetentionPrediction(BaseModel):
    chunk_id: str
    session_id: str
    retention_score: float
    key_points: List[str]


class SessionStateUpdate(BaseModel):
    session_id: str
    engagement_avg: Optional[float] = None
    clarity_avg: Optional[float] = None
    latest_transcript: Optional[str] = None
    latest_question: Optional[str] = None
    retention_score: Optional[float] = None


class CoachInsight(BaseModel):
    category: Literal["strength", "improvement", "critical"]
    text: str
    evidence: str


class RewriteSuggestion(BaseModel):
    original: str
    improved: str
    reason: str


class SessionReportCreate(BaseModel):
    session_id: uuid.UUID
    overall_score: Optional[float] = None
    engagement_avg: Optional[float] = None
    clarity_avg: Optional[float] = None
    insights: List[CoachInsight] = []
    rewrites: List[RewriteSuggestion] = []
    summary: Optional[str] = None
    coach_model: Optional[str] = None
