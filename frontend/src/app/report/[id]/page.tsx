"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { InsightCard } from "@/components/report/InsightCard";
import { EngagementHeatmap } from "@/components/report/EngagementHeatmap";

interface PageProps {
  params: { id: string };
}

export default function ReportPage({ params }: PageProps) {
  const router = useRouter();
  const { report, reportStatus, fetchReport, session } = useAppStore();

  useEffect(() => {
    void fetchReport(params.id);
  }, [params.id, fetchReport]);

  if (reportStatus === "idle" || reportStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="animate-pulse text-gray-500">Generating your coaching report…</p>
      </main>
    );
  }

  if (reportStatus === "error" || !report) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950">
        <p className="text-gray-400">Report not ready yet.</p>
        <button
          onClick={() => void fetchReport(params.id)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition hover:bg-brand-600"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Session <span className="text-brand-500">Report</span>
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Session {params.id.slice(0, 8)}&hellip;
            </p>
          </div>
          {report.overall_score !== null && (
            <div className="text-center">
              <p className="text-4xl font-bold text-brand-500">
                {report.overall_score.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">/ 10</p>
            </div>
          )}
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Summary
            </h2>
            <p className="text-sm leading-relaxed text-gray-200">{report.summary}</p>
          </div>
        )}

        {/* Heatmap */}
        <EngagementHeatmap
          engagementAvg={report.engagement_avg}
          clarityAvg={report.clarity_avg}
          durationSeconds={session?.duration_seconds ?? null}
        />

        {/* Insights */}
        {report.insights.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Coach Insights
            </h2>
            <div className="space-y-3">
              {report.insights.map((insight, i) => (
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
                  className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4"
                >
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-red-400">Original</p>
                    <p className="text-sm italic text-gray-400">&ldquo;{rw.original}&rdquo;</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-emerald-400">
                      Improved
                    </p>
                    <p className="text-sm text-gray-200">&ldquo;{rw.improved}&rdquo;</p>
                  </div>
                  <p className="text-xs text-gray-600">{rw.reason}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <button
          onClick={() => router.push("/")}
          className="w-full rounded-lg border border-gray-800 py-3 text-sm text-gray-400 transition hover:border-gray-700 hover:text-gray-300"
        >
          Start New Session
        </button>
      </div>
    </main>
  );
}
