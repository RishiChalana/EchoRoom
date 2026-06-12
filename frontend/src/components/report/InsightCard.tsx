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

// Safety net: never render raw internals (chunk UUIDs, dict/JSON, field names)
// that the model may leak into the evidence field. Returns clean text or null.
function cleanEvidence(raw: string): string | null {
  const looksRaw = (s: string): boolean =>
    s.includes("{") ||
    s.includes("chunk_id") ||
    s.includes("segment_classifications") ||
    s.includes("': '");

  if (!looksRaw(raw)) return raw.trim() || null;

  // Fall back to the part before the first ":" if that portion is clean.
  const head = raw.split(":")[0].trim();
  if (head && !looksRaw(head)) return head;

  return null; // hide entirely
}

export function InsightCard({ insight }: InsightCardProps) {
  const style = STYLES[insight.category];
  const evidence = cleanEvidence(insight.evidence);

  return (
    <div className={cn("space-y-2 rounded-xl border bg-gray-900/60 p-4", style.border)}>
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.badge)}>
        {style.label}
      </span>
      <p className="text-sm text-gray-200">{insight.text}</p>
      {evidence && <p className="text-xs text-gray-500">{evidence}</p>}
    </div>
  );
}
