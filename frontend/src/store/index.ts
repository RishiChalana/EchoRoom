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
import { apiFetch } from "@/lib/utils";

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
  createSession: (audienceProfile: string) => Promise<Session>;
  endSession: (sessionId: string) => Promise<void>;
  updateFromStateEvent: (update: SessionStateUpdate) => void;
  resetSession: () => void;
}

// ── Report Slice ──────────────────────────────────────────────────────────────
interface ReportSlice {
  report: SessionReport | null;
  reportStatus: "idle" | "loading" | "ready" | "error";
  fetchReport: (sessionId: string) => Promise<void>;
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

      createSession: async (audienceProfile: string) => {
        set({ sessionStatus: "loading" });
        try {
          const session = await apiFetch<Session>("/api/v1/sessions", {
            method: "POST",
            body: JSON.stringify({ audience_profile: audienceProfile }),
          });
          set({ session, sessionStatus: "active" });
          return session;
        } catch (err) {
          set({ sessionStatus: "error" });
          throw err;
        }
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

      fetchReport: async (sessionId: string) => {
        set({ reportStatus: "loading" });
        try {
          const report = await apiFetch<SessionReport>(`/api/v1/reports/${sessionId}`);
          set({ report, reportStatus: "ready" });
        } catch (err) {
          set({ reportStatus: "error" });
          throw err;
        }
      },
    }),
    { name: "EchoRoom" }
  )
);
