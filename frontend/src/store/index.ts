/**
 * EchoRoom Zustand Store
 *
 * Centralised application state.
 * Each slice maps to a domain — health, session, report, etc.
 * Slices for agents are added in Week 2+.
 */
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { FullHealthResponse, HealthStatus } from "@/types";
import { apiFetch } from "@/lib/utils";

// ── Health Slice ───────────────────────────────────────────────────────────────
interface HealthSlice {
  health: FullHealthResponse | null;
  healthStatus: "idle" | "loading" | "success" | "error";
  lastChecked: Date | null;
  checkHealth: () => Promise<void>;
}

// ── App Store ─────────────────────────────────────────────────────────────────
type AppStore = HealthSlice;

export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // ── Health ──────────────────────────────────────────────────────────────
      health: null,
      healthStatus: "idle",
      lastChecked: null,

      checkHealth: async () => {
        set({ healthStatus: "loading" });
        try {
          const data = await apiFetch<FullHealthResponse>("/api/v1/health/full");
          set({
            health: data,
            healthStatus: "success",
            lastChecked: new Date(),
          });
        } catch (err) {
          set({ healthStatus: "error", lastChecked: new Date() });
          console.error("[EchoRoom] Health check failed:", err);
        }
      },
    }),
    { name: "EchoRoom" }
  )
);
