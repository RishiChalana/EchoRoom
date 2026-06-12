"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { AudienceProfile } from "@/types";

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | undefined }) {
  const colour =
    {
      healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      degraded: "bg-yellow-500/20  text-yellow-400  border-yellow-500/30",
      unhealthy: "bg-red-500/20     text-red-400     border-red-500/30",
      unknown: "bg-gray-500/20    text-gray-400    border-gray-500/30",
      loading: "bg-blue-500/20    text-blue-400    border-blue-500/30",
    }[status ?? "unknown"] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide",
        colour
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status ?? "unknown"}
    </span>
  );
}

// ── Service Row ───────────────────────────────────────────────────────────────
function ServiceRow({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
      <span className="text-sm text-gray-300">{name}</span>
      <StatusBadge status={status} />
    </div>
  );
}

// ── Start Session Panel ───────────────────────────────────────────────────────
const PROFILES: { value: AudienceProfile; label: string }[] = [
  { value: "general", label: "General" },
  { value: "technical", label: "Technical" },
  { value: "executive", label: "Executive" },
  { value: "students", label: "Students" },
];

function StartSessionPanel() {
  const router = useRouter();
  const { createSession, sessionStatus } = useAppStore();
  const [profile, setProfile] = useState<AudienceProfile>("general");

  const handleStart = async () => {
    try {
      const session = await createSession(profile);
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error("[EchoRoom] Failed to create session:", err);
    }
  };

  const isLoading = sessionStatus === "loading";

  return (
    <div className="w-full max-w-sm space-y-4 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
        Start a Session
      </h2>

      <div>
        <label className="mb-2 block text-xs text-gray-500">Audience Profile</label>
        <div className="grid grid-cols-2 gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.value}
              onClick={() => setProfile(p.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm transition",
                profile === p.value
                  ? "border-brand-500 bg-brand-500/20 text-brand-500"
                  : "border-gray-800 text-gray-400 hover:border-gray-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => void handleStart()}
        disabled={isLoading}
        className={cn(
          "w-full rounded-xl py-3 text-sm font-medium transition",
          isLoading
            ? "cursor-not-allowed bg-brand-500/50 text-white"
            : "bg-brand-500 text-white hover:bg-brand-600"
        )}
      >
        {isLoading ? "Starting…" : "Start Session"}
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { health, healthStatus, lastChecked, checkHealth } = useAppStore();

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const isLoading = healthStatus === "idle" || healthStatus === "loading";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs text-brand-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          Agentic Communication Intelligence
        </div>
        <h1 className="mb-3 text-5xl font-bold tracking-tight text-white">
          Echo<span className="text-brand-500">Room</span>
        </h1>
        <p className="max-w-md text-gray-400">
          Real-time multi-agent speech analysis. Practice, get feedback, improve.
        </p>
      </div>

      {/* Start Session */}
      <StartSessionPanel />

      {/* System Status */}
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900/50 p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            System Status
          </h2>
          {isLoading ? (
            <span className="animate-pulse text-xs text-gray-500">checking…</span>
          ) : (
            <StatusBadge status={health?.status} />
          )}
        </div>

        <div className="space-y-2">
          <ServiceRow
            name="API"
            status={isLoading ? "loading" : healthStatus === "error" ? "unhealthy" : "healthy"}
          />
          <ServiceRow
            name="PostgreSQL"
            status={isLoading ? "loading" : (health?.services?.database?.status ?? "unknown")}
          />
          <ServiceRow
            name="Redis"
            status={isLoading ? "loading" : (health?.services?.redis?.status ?? "unknown")}
          />
        </div>

        {lastChecked && (
          <p className="mt-4 text-center text-xs text-gray-600">
            Last checked {lastChecked.toLocaleTimeString()}
          </p>
        )}
        {health && (
          <p className="mt-1 text-center text-xs text-gray-700">
            {health.latency_ms}ms · v{health.version} · {health.environment}
          </p>
        )}
      </div>
    </main>
  );
}
