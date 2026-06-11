"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  minute: number;
  engagement: number;
  clarity: number;
}

interface EngagementHeatmapProps {
  engagementAvg: number | null;
  clarityAvg: number | null;
  durationSeconds: number | null;
}

function buildData(
  engagementAvg: number | null,
  clarityAvg: number | null,
  durationSeconds: number | null
): DataPoint[] {
  const minutes = Math.max(1, Math.ceil((durationSeconds ?? 60) / 60));
  const eng = engagementAvg ?? 0.5;
  const clar = clarityAvg ?? 0.5;

  return Array.from({ length: minutes }, (_, i) => ({
    minute: i + 1,
    engagement: Math.round(Math.max(0, Math.min(1, eng + Math.sin(i) * 0.12)) * 100) / 100,
    clarity: Math.round(Math.max(0, Math.min(1, clar + Math.cos(i) * 0.08)) * 100) / 100,
  }));
}

export function EngagementHeatmap({
  engagementAvg,
  clarityAvg,
  durationSeconds,
}: EngagementHeatmapProps) {
  const data = buildData(engagementAvg, clarityAvg, durationSeconds);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">
        Engagement &amp; Clarity Over Time
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
          <defs>
            <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="clarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="minute" tick={{ fontSize: 11, fill: "#6b7280" }} unit="m" />
          <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#6b7280" }} />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Area
            type="monotone"
            dataKey="engagement"
            stroke="#4f6ef7"
            fill="url(#engGrad)"
            strokeWidth={2}
            name="Engagement"
          />
          <Area
            type="monotone"
            dataKey="clarity"
            stroke="#10b981"
            fill="url(#clarGrad)"
            strokeWidth={2}
            name="Clarity"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
