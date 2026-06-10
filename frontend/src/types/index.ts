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

// ── Future types (added as agents are built) ──────────────────────────────────
// export interface TranscriptChunk { ... }       // Week 1
// export interface EngagementSignal { ... }      // Week 2
// export interface ClarityAnalysis { ... }       // Week 3
// export interface SessionStateUpdate { ... }    // Week 4
// export interface SessionReport { ... }         // Week 7
