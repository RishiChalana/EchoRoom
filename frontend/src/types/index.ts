export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  environment: string;
  timestamp: string;
}

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatus = "active" | "processing" | "complete" | "failed";
export type AudienceProfile = "general" | "technical" | "interview" | "presentation";

export interface OAuthUser {
  name: string;
  email: string;
  image?: string;
}

export interface Session {
  id: string;
  status: SessionStatus;
  audience_profile: AudienceProfile | string;
  name?: string | null;
  duration_seconds: number | null;
  overall_score: number | null;
  created_at: string;
  ended_at: string | null;
  report_ready: boolean;
  is_public?: boolean;
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
  wpm?: number | null;
  insights: CoachInsight[];
  rewrites: RewriteSuggestion[];
  summary: string | null;
  coach_model: string | null;
  created_at: string;
  engagement_timeline: EngagementTimelinePoint[];
}

// ── Agent events ──────────────────────────────────────────────────────────────

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
}

// ── Transcript recovery (GET /sessions/{id}/transcript) ───────────────────────

export interface RecoveredTranscriptChunk {
  chunk_id: string;
  session_id: string;
  text: string;
  language: string;
  no_speech_prob: number;
  created_at: string;
}

export interface TranscriptRecoveryResponse {
  transcript_chunks: RecoveredTranscriptChunk[];
  latest_engagement_avg: number | null;
}
