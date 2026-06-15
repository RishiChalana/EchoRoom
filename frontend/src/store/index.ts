import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Session,
  SessionReport,
  SessionStateUpdate,
  TranscriptChunk,
} from "@/types";
import { apiFetch, API_URL } from "@/lib/utils";

export type ReportFetchResult = "ready" | "generating" | "not_found" | "error";

// ── Session Slice ─────────────────────────────────────────────────────────────
interface SessionSlice {
  session: Session | null;
  sessionStatus: "idle" | "loading" | "active" | "ended" | "error";
  engagementAvg: number | null;
  clarityAvg: number | null;
  latestTranscript: string | null;
  transcriptHistory: TranscriptChunk[];
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

type AppStore = SessionSlice & ReportSlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      // ── Session ─────────────────────────────────────────────────────────────
      session: null,
      sessionStatus: "idle",
      engagementAvg: null,
      clarityAvg: null,
      latestTranscript: null,
      transcriptHistory: [],

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
          const res = await fetch(`${API_URL}/api/v1/reports/${sessionId}`, {
            headers: { "Content-Type": "application/json" },
            credentials: "include",
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
