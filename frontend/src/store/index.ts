/**
 * EchoRoom Zustand Store
 *
 * Centralised application state.
 * Slices: health, session, report.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  FullHealthResponse,
  Session,
  SessionReport,
  SessionStateUpdate,
  TranscriptChunk,
} from "@/types";
import { apiFetch, API_URL } from "@/lib/utils";

// Outcome of a single report poll — lets the page decide whether to keep polling.
export type ReportFetchResult = "ready" | "generating" | "not_found" | "error";

// ── Health Slice ───────────────────────────────────────────────────────────────
interface HealthSlice {
  health: FullHealthResponse | null;
  healthStatus: "idle" | "loading" | "success" | "error";
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
}

// ── Session Slice ─────────────────────────────────────────────────────────────
interface SessionSlice {
  session: Session | null;
  sessionStatus: "idle" | "loading" | "active" | "ended" | "error";
  engagementAvg: number | null;
  clarityAvg: number | null;
  latestTranscript: string | null;
  transcriptHistory: TranscriptChunk[];
  createSession: (audienceProfile: string, name?: string) => Promise<Session>;
  loadSession: (sessionId: string) => Promise<Session>;
  endSession: (sessionId: string) => Promise<void>;
  updateFromStateEvent: (update: SessionStateUpdate) => void;
  resetSession: () => void;
}

// ── Report Slice ──────────────────────────────────────────────────────────────
interface ReportSlice {
  report: SessionReport | null;
  reportStatus: "idle" | "loading" | "generating" | "ready" | "error";
  fetchReport: (sessionId: string) => Promise<ReportFetchResult>;
}

// ── App Store ─────────────────────────────────────────────────────────────────
type AppStore = HealthSlice & SessionSlice & ReportSlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // ── Health ──────────────────────────────────────────────────────────────
      health: null,
      healthStatus: "idle",
      lastChecked: null,

      checkHealth: async () => {
        set({ healthStatus: "loading" });
        try {
          const data = await apiFetch<FullHealthResponse>("/api/v1/health/full");
          set({ health: data, healthStatus: "success", lastChecked: new Date() });
        } catch (err) {
          set({ healthStatus: "error", lastChecked: new Date() });
          console.error("[EchoRoom] Health check failed:", err);
        }
      },

      // ── Session ─────────────────────────────────────────────────────────────
      session: null,
      sessionStatus: "idle",
      engagementAvg: null,
      clarityAvg: null,
      latestTranscript: null,
      transcriptHistory: [],

      createSession: async (audienceProfile: string, name?: string) => {
        set({ sessionStatus: "loading" });
        try {
          const session = await apiFetch<Session>("/api/v1/sessions", {
            method: "POST",
            body: JSON.stringify({ audience_profile: audienceProfile, name: name ?? null }),
          });
          set({ session, sessionStatus: "active" });
          return session;
        } catch (err) {
          set({ sessionStatus: "error" });
          throw err;
        }
      },
      loadSession: async (sessionId: string) => {
        const data = await apiFetch<Session>(`/api/v1/sessions/${sessionId}`);
        set({ session: data, sessionStatus: "active" });
        return data;
      },

      endSession: async (sessionId: string) => {
        try {
          const session = await apiFetch<Session>(`/api/v1/sessions/${sessionId}/end`, {
            method: "PATCH",
          });
          set({ session, sessionStatus: "ended" });
        } catch (err) {
          set({ sessionStatus: "error" });
          throw err;
        }
      },

      updateFromStateEvent: (update: SessionStateUpdate) => {
        const patch: Partial<AppStore> = {};
        if (update.engagement_avg !== null) patch.engagementAvg = update.engagement_avg;
        if (update.clarity_avg !== null) patch.clarityAvg = update.clarity_avg;
        if (update.latest_transcript !== null) patch.latestTranscript = update.latest_transcript;

        // Append to history only when the transcript is present and changed — the
        // orchestrator re-sends the same latest_transcript on every state event.
        if (update.latest_transcript) {
          const history = get().transcriptHistory;
          const last = history[history.length - 1];
          if (!last || last.text !== update.latest_transcript) {
            const chunk: TranscriptChunk = {
              chunk_id: `${Date.now()}-${history.length}`,
              session_id: update.session_id,
              text: update.latest_transcript,
              words: [],
              language: "",
              avg_logprob: 0,
              no_speech_prob: 0,
            };
            patch.transcriptHistory = [...history, chunk];
          }
        }

        set(patch);
      },

      resetSession: () => {
        set({
          session: null,
          sessionStatus: "idle",
          engagementAvg: null,
          clarityAvg: null,
          latestTranscript: null,
          transcriptHistory: [],
        });
      },

      // ── Report ───────────────────────────────────────────────────────────────
      report: null,
      reportStatus: "idle",

      fetchReport: async (sessionId: string): Promise<ReportFetchResult> => {
        try {
          // Raw fetch (not apiFetch) so we can read the 202 "generating" status.
          const res = await fetch(`${API_URL}/api/v1/reports/${sessionId}`, {
            headers: { "Content-Type": "application/json" },
          });

          if (res.status === 202) {
            set({ reportStatus: "generating" });
            return "generating";
          }
          if (res.status === 404) {
            set({ reportStatus: "error" });
            return "not_found";
          }
          if (!res.ok) {
            set({ reportStatus: "error" });
            return "error";
          }

          const report = (await res.json()) as SessionReport;
          set({ report, reportStatus: "ready" });
          return "ready";
        } catch (err) {
          set({ reportStatus: "error" });
          console.error("[EchoRoom] Failed to fetch report:", err);
          return "error";
        }
      },
    }),
    { name: "EchoRoom" }
  )
);
