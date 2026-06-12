"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { InsightCard } from "@/components/report/InsightCard";
import { EngagementHeatmap } from "@/components/report/EngagementHeatmap";

interface PageProps {
  params: { id: string };
}

const MAX_ATTEMPTS = 20; // hard cap: ~60s of polling
const POLL_INTERVAL_MS = 3000;

type Phase = "polling" | "ready" | "notfound" | "gaveup";

const INSIGHT_ORDER: Record<string, number> = { critical: 0, improvement: 1, strength: 2 };

function scoreColor(score: number): string {
  if (score < 4) return "#ef4444"; // red
  if (score <= 7) return "#f59e0b"; // amber
  return "#10b981"; // emerald
}

function ScoreRing({ score }: { score: number }) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 10));
  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{score.toFixed(1)}</span>
        <span className="text-[10px] text-gray-500">/ 10</span>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-200">
        {value === null ? "—" : `${Math.round(value * 100)}%`}
      </p>
    </div>
  );
}

export default function ReportPage({ params }: PageProps) {
  const router = useRouter();
  const { report, fetchReport } = useAppStore();
  const [phase, setPhase] = useState<Phase>("polling");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let count = 0;

    const poll = async () => {
      const result = await fetchReport(params.id);
      if (cancelled) return;
      count += 1;

      if (result === "ready") {
        setPhase("ready");
        return;
      }
      if (result === "not_found") {
        setPhase("notfound");
        return;
      }
      if (count >= MAX_ATTEMPTS) {
        setPhase("gaveup");
        return;
      }
      // "generating" or a transient "error" → keep polling.
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    setPhase("polling");
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params.id, fetchReport, retryKey]);

  if (phase === "polling") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="animate-pulse text-gray-500">Generating your report…</p>
      </main>
    );
  }

  if (phase === "notfound") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950">
        <p className="text-gray-400">Report not available.</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition hover:bg-brand-600"
        >
          Back Home
        </button>
      </main>
    );
  }

  if (phase === "gaveup" || !report) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950">
        <p className="text-gray-400">This is taking longer than expected.</p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition hover:bg-brand-600"
        >
          Retry
        </button>
      </main>
    );
  }

  const sortedInsights = [...report.insights].sort(
    (a, b) => (INSIGHT_ORDER[a.category] ?? 9) - (INSIGHT_ORDER[b.category] ?? 9)
  );
  const counts = {
    critical: report.insights.filter((i) => i.category === "critical").length,
    improvement: report.insights.filter((i) => i.category === "improvement").length,
    strength: report.insights.filter((i) => i.category === "strength").length,
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echoroom-report-${report.session_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lowClarity = report.clarity_avg !== null && report.clarity_avg < 0.4;

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Session <span className="text-brand-500">Report</span>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Session {params.id.slice(0, 8)}&hellip;
            </p>
            <div className="mt-4 flex gap-2">
              <StatChip label="Engagement" value={report.engagement_avg} />
              <StatChip label="Clarity" value={report.clarity_avg} />
            </div>
          </div>
          {report.overall_score !== null && <ScoreRing score={report.overall_score} />}
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Summary
            </h2>
            <p className="text-sm leading-relaxed text-gray-200">{report.summary}</p>
            {lowClarity && (
              <p className="mt-2 text-xs text-amber-500/80">
                Clarity was low this session — see rewrites below.
              </p>
            )}
          </div>
        )}

        {/* Engagement timeline */}
        <EngagementHeatmap timeline={report.engagement_timeline} />

        {/* Insights */}
        {report.insights.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Coach Insights
              </h2>
              <div className="flex gap-1.5">
                {counts.critical > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                    {counts.critical} critical
                  </span>
                )}
                {counts.improvement > 0 && (
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                    {counts.improvement} improve
                  </span>
                )}
                {counts.strength > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    {counts.strength} strength
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {sortedInsights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Rewrites */}
        {report.rewrites.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Suggested Rewrites
            </h2>
            <div className="space-y-4">
              {report.rewrites.map((rw, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-b from-red-500/5 to-emerald-500/5"
                >
                  <div className="border-l-2 border-red-500/50 p-4">
                    <p className="mb-1 text-xs uppercase tracking-wide text-red-400">Original</p>
                    <p className="text-sm italic text-gray-400">&ldquo;{rw.original}&rdquo;</p>
                  </div>
                  <div className="border-l-2 border-emerald-500/50 p-4 pt-0">
                    <p className="mb-1 text-xs uppercase tracking-wide text-emerald-400">
                      Improved
                    </p>
                    <p className="text-sm text-gray-200">&ldquo;{rw.improved}&rdquo;</p>
                    <p className="mt-2 text-xs text-gray-600">{rw.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex-1 rounded-lg bg-brand-500 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Start New Session
          </button>
          <button
            onClick={downloadJson}
            className="rounded-lg border border-gray-800 px-4 py-3 text-sm text-gray-400 transition hover:border-gray-700 hover:text-gray-300"
          >
            Download Report (JSON)
          </button>
        </div>
      </div>
    </main>
  );
}
