"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrendingUp, Target, Mic } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  ResponsiveContainer,
} from "recharts";
import { AuthedLayout } from "@/components/layout/AuthedLayout";
import { useTheme } from "@/components/layout/ThemeProvider";
import { getSessions } from "@/lib/api";
import type { Session } from "@/types";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function roomLabel(profile: string): string {
  const map: Record<string, string> = {
    technical: "Technical",
    interview: "Interview",
    presentation: "Presentation",
    general: "General",
  };
  return map[profile] ?? profile;
}

export default function DashboardPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const recent = sessions
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 3);

  const mostRecentRoom = recent[0]?.audience_profile ?? null;
  const hasSessions = sessions.length > 0;

  // Build trend chart data (last 3 weeks)
  const now = Date.now();
  const weeks = [0, 1, 2].map((w) => {
    const weekStart = now - (w + 1) * 7 * 86400_000;
    const weekEnd   = now - w * 7 * 86400_000;
    const wSessions = sessions.filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t >= weekStart && t < weekEnd;
    });
    const avg = wSessions.length
      ? wSessions.reduce((acc, s) => acc + (s.overall_score ?? 0), 0) / wSessions.length
      : 0;
    return { week: `W${3 - w}`, count: wSessions.length, score: Math.round(avg) };
  }).reverse();

  const personalInsight = hasSessions
    ? `Your ${roomLabel(mostRecentRoom ?? "")} sessions show a consistent trend.`
    : "Ready to start? Your first session is waiting.";

  const isDark = theme === "dark";
  const axisColor  = isDark ? "#666670" : "#76777b";
  const barFill    = isDark ? "#333338" : "#e1e3e4";
  const lineStroke = isDark ? "#5b8fff" : "#004fda";

  return (
    <AuthedLayout>
      {/* Header */}
      <div className="flex flex-col gap-5 pt-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[40px] font-bold text-er-ink">
            Your Progress.
          </h1>
          <p className="mt-2 max-w-[520px] font-sans text-[16px] text-er-ink-2">
            {personalInsight}
          </p>
        </div>
        <Link
          href="/rooms"
          className="flex h-11 shrink-0 items-center rounded-lg bg-er-ink px-5 font-label text-[14px] font-medium uppercase tracking-wide text-white transition-opacity hover:opacity-90"
        >
          ▶ Start New Session
        </Link>
      </div>

      {hasSessions ? (
        <>
          {/* Two-column grid */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            {/* Performance trend card */}
            <div className="rounded border border-er-border bg-er-surface p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-er-blue" />
                  <span className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
                    Performance Trend
                  </span>
                </div>
                <span className="font-sans text-[13px] text-er-ink-3">Past 30 Days</span>
              </div>

              <p className="mt-3 font-display text-[20px] font-semibold text-er-ink">
                {mostRecentRoom ? `${roomLabel(mostRecentRoom)} Delivery` : "All Rooms"}
              </p>

              {weeks.some((w) => w.count > 0) ? (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={weeks} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <XAxis
                        dataKey="week"
                        tick={{ fontSize: 12, fill: axisColor, fontFamily: "var(--font-geist-mono)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Bar dataKey="count" fill={barFill} radius={[2, 2, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke={lineStroke}
                        strokeWidth={2}
                        dot={{ r: 3, fill: lineStroke }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-8 text-center font-sans text-[14px] text-er-ink-3">
                  Practice regularly to see your trend.
                </p>
              )}
            </div>

            {/* Current focus card */}
            <div className="rounded border border-er-border bg-er-surface-2 p-6">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-er-amber" />
                <span className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
                  Current Focus
                </span>
              </div>
              <h3 className="mt-3 font-display text-[22px] font-semibold text-er-ink">
                Communication Clarity
              </h3>
              <p className="mt-2 font-sans text-[15px] text-er-ink-2">
                Focus on clear, direct delivery. Reduce filler words and improve
                sentence structure for maximum impact.
              </p>

              <div className="mt-5 rounded border border-er-border bg-er-surface p-4">
                <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-blue">
                  Next Session Goal
                </p>
                <p className="mt-1.5 font-sans text-[14px] text-er-ink-2">
                  Complete a{" "}
                  {mostRecentRoom ? roomLabel(mostRecentRoom).toLowerCase() : "general"}{" "}
                  session aiming for a score above your previous best.
                </p>
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[20px] font-semibold text-er-ink">
                Recent Sessions
              </h2>
              <Link
                href="/library"
                className="font-label text-[13px] text-er-blue transition-colors hover:text-er-blue-2"
              >
                VIEW ALL →
              </Link>
            </div>

            <div className="mt-4 divide-y divide-er-border overflow-hidden rounded border border-er-border bg-er-surface">
              {recent.map((s) => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/report/${s.id}`)}
                  className="flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-er-surface-2"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-er-surface-3">
                    <Mic size={16} className="text-er-ink-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-[16px] font-medium text-er-ink truncate">
                      {s.name ?? roomLabel(s.audience_profile)}
                    </p>
                    <p className="font-sans text-[13px] text-er-ink-3">
                      {roomLabel(s.audience_profile)} &middot; {formatDate(s.created_at)}
                    </p>
                  </div>
                  {s.overall_score !== null && (
                    <span className="shrink-0 rounded border border-er-border bg-er-surface-2 px-3 py-1 font-mono text-[13px] text-er-ink-2">
                      Score: {s.overall_score}
                    </span>
                  )}
                  <div className="shrink-0 text-right">
                    <span className="font-sans text-[13px] text-er-ink-3">
                      {formatDate(s.created_at)} &middot; {formatDuration(s.duration_seconds)}
                    </span>
                  </div>
                  <span className="text-er-ink-3">›</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="mt-20 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-er-surface-3">
            <Mic size={28} className="text-er-ink-4" />
          </div>
          <h2 className="mt-5 font-display text-[22px] font-semibold text-er-ink">
            {loading ? "Loading…" : "No sessions yet."}
          </h2>
          {!loading && (
            <>
              <p className="mt-2 max-w-[380px] font-sans text-[16px] text-er-ink-3">
                Choose a room and start practicing. Your progress will appear here.
              </p>
              <Link
                href="/rooms"
                className="mt-6 flex h-11 items-center rounded-lg bg-er-ink px-5 font-sans text-[15px] font-medium text-white"
              >
                Start your first session →
              </Link>
            </>
          )}
        </div>
      )}
    </AuthedLayout>
  );
}
