"use client";

import { cn } from "@/lib/utils";
import type { CoachInsight } from "@/types";

interface InsightCardProps {
  insight: CoachInsight;
}

const STYLES = {
  strength: {
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-400",
    label: "Strength",
  },
  improvement: {
    border: "border-yellow-500/30",
    badge: "bg-yellow-500/20 text-yellow-400",
    label: "Improve",
  },
  critical: {
    border: "border-red-500/30",
    badge: "bg-red-500/20 text-red-400",
    label: "Critical",
  },
} as const;

export function InsightCard({ insight }: InsightCardProps) {
  const style = STYLES[insight.category];

  return (
    <div className={cn("space-y-2 rounded-xl border bg-gray-900/60 p-4", style.border)}>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>
        {style.label}
      </span>
      <p className="text-sm text-gray-200">{insight.text}</p>
      <p className="text-xs text-gray-500">{insight.evidence}</p>
    </div>
  );
}
