"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | undefined }) {
  const colour = {
    healthy:   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    degraded:  "bg-yellow-500/20  text-yellow-400  border-yellow-500/30",
    unhealthy: "bg-red-500/20     text-red-400     border-red-500/30",
    unknown:   "bg-gray-500/20    text-gray-400    border-gray-500/30",
    loading:   "bg-blue-500/20    text-blue-400    border-blue-500/30",
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
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="mb-12 text-center">
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

      {/* ── System Status ────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-900/50 p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            System Status
          </h2>
          {isLoading ? (
            <span className="text-xs text-gray-500 animate-pulse">checking…</span>
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

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <p className="mt-12 text-center text-xs text-gray-700">
        Foundation ready · Agents coming in Week 2
      </p>
    </main>
  );
}
