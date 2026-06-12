// ─────────────────────────────────────────────────────────────────────────────
// EchoRoom TypeScript Type Definitions
//
// These mirror the Pydantic schemas in backend/app/schemas/.
// Keep in sync manually — or run the codegen script (added in Week 8).
// ─────────────────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface ServiceStatus {
  name: string;
  status: HealthStatus;
  message?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  environment: string;
  timestamp: string;
}

export interface FullHealthResponse extends HealthResponse {
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
  latency_ms: number;
}

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatus = "active" | "processing" | "complete" | "failed";
export type AudienceProfile = "general" | "technical" | "executive" | "students";

export interface Session {
  id: string;
  status: SessionStatus;
  audience_profile: AudienceProfile | string;
  duration_seconds: number | null;
  overall_score: number | null;
  created_at: string;
  ended_at: string | null;
  report_ready: boolean;
}

export interface SessionList {
  sessions: Session[];
}

// ── Report ────────────────────────────────────────────────────────────────────

export interface CoachInsight {
  category: "strength" | "improvement" | "critical";
  text: string;
  evidence: string;
}

export interface RewriteSuggestion {
  original: string;
  improved: string;
  reason: string;
}

export interface EngagementTimelinePoint {
  index: number;
  engagement_score: number;
  text_preview: string;
}

export interface SessionReport {
  id: string;
  session_id: string;
  overall_score: number | null;
  engagement_avg: number | null;
  clarity_avg: number | null;
  insights: CoachInsight[];
  rewrites: RewriteSuggestion[];
  summary: string | null;
  coach_model: string | null;
  created_at: string;
  engagement_timeline: EngagementTimelinePoint[];
}

// ── Agent events (mirroring backend/app/schemas/events.py) ───────────────────

export interface WordToken {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface TranscriptChunk {
  chunk_id: string;
  session_id: string;
  text: string;
  words: WordToken[];
  language: string;
  avg_logprob: number;
  no_speech_prob: number;
}

export interface EngagementSignal {
  chunk_id: string;
  session_id: string;
  score: number;
  label: "low" | "medium" | "high";
  features: Record<string, number>;
}

export interface ClarityIssue {
  issue_type: "jargon" | "filler" | "passive" | "ambiguous";
  text: string;
  suggestion: string;
}

export interface ClarityAnalysis {
  chunk_id: string;
  session_id: string;
  score: number;
  issues: ClarityIssue[];
}

export interface SessionStateUpdate {
  session_id: string;
  engagement_avg: number | null;
  clarity_avg: number | null;
  latest_transcript: string | null;
  latest_question: string | null;
  retention_score: number | null;
}
