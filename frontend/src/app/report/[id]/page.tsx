"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
} from "recharts";
import { useAppStore } from "@/store";
import { cn } from "@/lib/utils";
import type { CoachInsight } from "@/types";

interface PageProps {
  params: { id: string };
}

const MAX_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;
type Phase = "polling" | "ready" | "notfound" | "gaveup";
const INSIGHT_ORDER: Record<string, number> = { critical: 0, improvement: 1, strength: 2 };

// ── Clean evidence helper ─────────────────────────────────────────────────────
function cleanEvidence(raw: string): string | null {
  const isRaw = (s: string) =>
    s.includes("{") || s.includes("chunk_id") || s.includes("': '");
  if (!isRaw(raw)) return raw.trim() || null;
  const head = raw.split(":")[0].trim();
  return head && !isRaw(head) ? head : null;
}

// ── Insight card ──────────────────────────────────────────────────────────────
const INSIGHT_STYLES = {
  critical:    { chip: "bg-[#fde8e8] text-[#ba1a1a]", label: "Critical" },
  improvement: { chip: "bg-[#fef3e2] text-[#92400e]", label: "Improvement" },
  strength:    { chip: "bg-[#e6f4ea] text-[#2d6a4f]", label: "Strength" },
} as const;

function InsightCard({ insight }: { insight: CoachInsight }) {
  const s = INSIGHT_STYLES[insight.category];
  const evidence = cleanEvidence(insight.evidence);
  return (
    <div className="rounded border border-er-border bg-er-surface p-5">
      <span className={cn("inline-block rounded px-2 py-0.5 font-label text-[12px] font-medium uppercase tracking-wide", s.chip)}>
        {s.label}
      </span>
      <p className="mt-2 font-sans text-[15px] text-er-ink">{insight.text}</p>
      {evidence && (
        <p className="mt-2 font-sans text-[14px] text-er-ink-3">{evidence}</p>
      )}
    </div>
  );
}

// ── Metric pill ───────────────────────────────────────────────────────────────
function MetricPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded border border-er-border bg-er-surface-2 px-3 font-label text-[13px] text-er-ink-2">
      {icon} {label}
    </span>
  );
}

// ── Avatar (top bar) ──────────────────────────────────────────────────────────
function TopBarAvatar() {
  const { data } = useSession();
  const user = data?.user;
  if (!user) return null;
  if (user.image) {
    return (
      <Image src={user.image} alt={user.name ?? "Avatar"} width={32} height={32} className="rounded-full" />
    );
  }
  const initials = (user.name ?? "U")
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-er-surface-4 font-label text-[13px] font-medium text-er-ink-2">
      {initials}
    </div>
  );
}

// ── Loading state ─────────────────────────────────────────────────────────────
function PollingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-er-bg px-4">
      <div className="w-full max-w-[480px] rounded-lg border border-er-border bg-er-surface p-10 text-center">
        <h2 className="font-display text-[24px] font-semibold text-er-ink">
          Generating your report…
        </h2>
        <div className="my-6 h-1 overflow-hidden rounded-full bg-er-surface-3">
          <div className="animate-progress-fill h-full rounded-full bg-er-blue" />
        </div>
        <p className="font-sans text-[14px] text-er-ink-3">
          This usually takes 15–30 seconds.
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
      if (result === "ready") { setPhase("ready"); return; }
      if (result === "not_found") { setPhase("notfound"); return; }
      if (count >= MAX_ATTEMPTS) { setPhase("gaveup"); return; }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    setPhase("polling");
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [params.id, fetchReport, retryKey]);

  if (phase === "polling") return <PollingState />;

  if (phase === "notfound") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-er-bg px-4">
        <p className="font-sans text-[16px] text-er-ink-2">Report not available.</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg bg-er-ink px-5 py-2.5 font-sans text-[14px] font-medium text-white"
        >
          Back Home
        </button>
      </div>
    );
  }

  if (phase === "gaveup" || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-er-bg px-4">
        <p className="font-sans text-[16px] text-er-ink-2">This is taking longer than expected.</p>
        <button
          onClick={() => setRetryKey((k) => k + 1)}
          className="rounded-lg bg-er-ink px-5 py-2.5 font-sans text-[14px] font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const sortedInsights = [...report.insights].sort(
    (a, b) => (INSIGHT_ORDER[a.category] ?? 9) - (INSIGHT_ORDER[b.category] ?? 9)
  );
  const counts = {
    critical:    report.insights.filter((i) => i.category === "critical").length,
    improvement: report.insights.filter((i) => i.category === "improvement").length,
    strength:    report.insights.filter((i) => i.category === "strength").length,
  };

  const firstStrength    = report.insights.find((i) => i.category === "strength");
  const firstImprovement = report.insights.find(
    (i) => i.category === "improvement" || i.category === "critical"
  );

  const sessionDate = new Date(report.created_at);
  const dateStr = sessionDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = sessionDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const sessionRef = `ER-${report.session_id.slice(0, 4).toUpperCase()}`;

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `echoroom-report-${report.session_id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = report.engagement_timeline.map((p, i) => ({
    index: i,
    value: p.engagement_score,
    accelerated: p.engagement_score > 0.8,
  }));

  return (
    <div className="min-h-screen bg-er-bg">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-er-border bg-er-surface px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-sans text-[14px] text-er-ink-2 transition-colors hover:text-er-ink"
        >
          <ArrowLeft size={16} />
          EchoRoom
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadJson}
            className="flex h-9 items-center gap-2 rounded-lg border border-er-border-2 px-3 font-label text-[14px] text-er-ink-2 transition-colors hover:border-er-ink-3 hover:text-er-ink"
          >
            <Download size={14} />
            Export
          </button>
          <TopBarAvatar />
        </div>
      </header>

      <div className="mx-auto max-w-[960px] px-6 pb-16">
        {/* Page header */}
        <div className="pt-10">
          <h1 className="font-display text-[36px] font-bold text-er-ink">
            {report.summary ? report.summary.slice(0, 60) : `Session · ${dateStr}`}
          </h1>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="font-sans text-[14px] text-er-ink-3">
              Session Ref: {sessionRef} &middot; {dateStr} &middot; {timeStr}
            </p>
            <div className="flex gap-2">
              {report.wpm != null && (
                <MetricPill icon="⚡" label={`${report.wpm} WPM`} />
              )}
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Card 1 — Score */}
          <div className="rounded border border-er-border bg-er-surface p-5">
            <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
              Clarity Index
            </p>
            {report.overall_score !== null ? (
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-[48px] font-bold leading-none text-er-ink">
                  {report.overall_score}
                </span>
                <span className="font-display text-[20px] font-normal text-er-ink-3">
                  / 100
                </span>
              </div>
            ) : (
              <p className="mt-2 font-sans text-[14px] text-er-ink-3">Generating…</p>
            )}
            {report.summary && (
              <p className="mt-3 font-sans text-[14px] leading-[1.6] text-er-ink-2">
                {report.summary}
              </p>
            )}
          </div>

          {/* Card 2 — Strength */}
          <div className="rounded border border-er-border bg-er-surface p-5">
            <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
              Strength{firstStrength ? `: ${firstStrength.category}` : ""}
            </p>
            <p className="mt-3 font-sans text-[15px] text-er-ink">
              {firstStrength?.text ?? "Generating analysis…"}
            </p>
          </div>

          {/* Card 3 — Focus */}
          <div className="rounded border border-er-border bg-er-surface p-5">
            <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
              Area for Focus{firstImprovement ? `: ${firstImprovement.category}` : ""}
            </p>
            <p className="mt-3 font-sans text-[15px] text-er-ink">
              {firstImprovement?.text ?? "Generating analysis…"}
            </p>
          </div>
        </div>

        {/* Engagement timeline */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[20px] font-semibold text-er-ink">
              Acoustic &amp; Pacing Timeline
            </h2>
            <span className="font-label text-[12px] text-er-ink-3 bg-er-surface-2 px-2 py-1 rounded">
              1 min intervals
            </span>
          </div>

          {chartData.length < 2 ? (
            <p className="mt-6 text-center font-sans text-[14px] text-er-ink-3">
              Not enough data for a timeline.
            </p>
          ) : (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="index"
                    tick={{ fontSize: 12, fill: "#76777b", fontFamily: "var(--font-geist)" }}
                    tickFormatter={(v: number) => {
                      if (v === 0) return "00:00";
                      if (v === Math.floor(chartData.length / 2))
                        return `${String(Math.floor(v / 2)).padStart(2, "0")}:00`;
                      if (v === chartData.length - 1) return "End";
                      return "";
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar
                    dataKey="value"
                    radius={[2, 2, 0, 0]}
                    fill="#191c1d"
                    isAnimationActive={false}
                    // Blue for accelerated bars
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 flex gap-4">
                <span className="flex items-center gap-1.5 font-label text-[12px] text-er-ink-3">
                  <span className="inline-block h-2 w-2 rounded-full bg-er-ink" />
                  Optimal Range
                </span>
                <span className="flex items-center gap-1.5 font-label text-[12px] text-er-ink-3">
                  <span className="inline-block h-2 w-2 rounded-full bg-er-blue" />
                  Accelerated (Rushed)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Insights */}
        {report.insights.length > 0 && (
          <div className="mt-12">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[20px] font-semibold text-er-ink">
                Coach Insights
              </h2>
              <div className="flex gap-2">
                {counts.critical > 0 && (
                  <span className="rounded bg-[#fde8e8] px-2 py-0.5 font-label text-[12px] text-[#ba1a1a]">
                    {counts.critical} critical
                  </span>
                )}
                {counts.improvement > 0 && (
                  <span className="rounded bg-[#fef3e2] px-2 py-0.5 font-label text-[12px] text-[#92400e]">
                    {counts.improvement} improve
                  </span>
                )}
                {counts.strength > 0 && (
                  <span className="rounded bg-[#e6f4ea] px-2 py-0.5 font-label text-[12px] text-[#2d6a4f]">
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
          </div>
        )}

        {/* Precision edits */}
        {report.rewrites.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-[20px] font-semibold text-er-ink">
              Precision Edits
            </h2>
            <p className="mt-1 font-sans text-[14px] text-er-ink-3">
              AI-identified improvements to enhance clarity and impact.
            </p>
            <div className="mt-4 space-y-4">
              {report.rewrites.map((rw, i) => (
                <div key={i} className="overflow-hidden rounded border border-er-border">
                  <div className="px-4 py-2">
                    <span className="font-mono text-[13px] text-er-ink-3">
                      {String(Math.floor(i * 90 / 60)).padStart(2, "0")}:
                      {String((i * 90) % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <hr className="border-er-border" />

                  {/* Original */}
                  <div className="relative px-4 py-4">
                    <p className="font-sans text-[15px] text-er-ink-2">{rw.original}</p>
                    <div
                      className="pointer-events-none absolute"
                      style={{ top: "50%", left: 16, right: 16, height: 1, background: "#45474a", opacity: 0.4 }}
                    />
                  </div>

                  {/* Arrow */}
                  <p className="py-1 text-center font-sans text-er-ink-3">↓</p>

                  {/* Improved */}
                  <div className="px-4 py-4" style={{ borderLeft: "3px solid var(--er-blue)", background: "#fafbff" }}>
                    <p className="font-sans text-[15px] text-er-ink">{rw.improved}</p>
                  </div>

                  {/* Reason chip */}
                  <div className="px-4 py-3">
                    <span className="inline-block rounded border border-er-border bg-er-surface-2 px-3 py-1 font-label text-[12px] text-er-ink-2">
                      {rw.reason}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-12 pb-16 text-center">
          <Link
            href="/rooms"
            className="inline-flex h-11 items-center rounded-lg bg-er-ink px-5 font-sans text-[15px] font-medium text-white transition-opacity hover:opacity-90"
          >
            Start New Session
          </Link>
          <p className="mt-4 font-mono text-[12px] text-er-ink-4">
            {report.session_id}
          </p>
        </div>
      </div>
    </div>
  );
}
