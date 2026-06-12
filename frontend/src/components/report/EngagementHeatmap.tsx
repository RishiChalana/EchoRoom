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
import type { EngagementTimelinePoint } from "@/types";

interface EngagementHeatmapProps {
  timeline: EngagementTimelinePoint[];
}

interface ChartPoint {
  chunk: number;
  engagement: number;
  preview: string;
}

interface TooltipPayloadEntry {
  payload: ChartPoint;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-[220px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-brand-500">
        Chunk {point.chunk} · {Math.round(point.engagement * 100)}% engaged
      </p>
      {point.preview && (
        <p className="mt-1 text-gray-400">&ldquo;{point.preview}…&rdquo;</p>
      )}
    </div>
  );
}

export function EngagementHeatmap({ timeline }: EngagementHeatmapProps) {
  const data: ChartPoint[] = timeline.map((p) => ({
    chunk: p.index + 1,
    engagement: p.engagement_score,
    preview: p.text_preview,
  }));

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">Engagement Over Time</h3>

      {data.length < 2 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-gray-600">
          Not enough data for a timeline.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
            <defs>
              <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="chunk"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              label={{ value: "chunk", position: "insideBottom", offset: -2, fill: "#4b5563", fontSize: 10 }}
            />
            <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: "#6b7280" }} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="engagement"
              stroke="#4f6ef7"
              fill="url(#engGrad)"
              strokeWidth={2}
              dot={{ r: 2, fill: "#4f6ef7" }}
              name="Engagement"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
