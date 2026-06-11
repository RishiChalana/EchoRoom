"use client";

import { cn } from "@/lib/utils";

type EngagementLevel = "low" | "medium" | "high";

interface AudienceMember {
  id: number;
  level: EngagementLevel;
}

interface AvatarGridProps {
  engagementAvg: number | null;
}

const RING: Record<EngagementLevel, string> = {
  high: "ring-2 ring-emerald-500",
  medium: "ring-2 ring-yellow-500",
  low: "ring-2 ring-red-500/60",
};

function buildGrid(engagementAvg: number | null): AudienceMember[] {
  const base = engagementAvg ?? 0.5;
  return Array.from({ length: 12 }, (_, i) => {
    const score = base * 0.7 + ((Math.sin(i * 2.5) + 1) / 2) * 0.3;
    const level: EngagementLevel = score > 0.65 ? "high" : score > 0.35 ? "medium" : "low";
    return { id: i, level };
  });
}

export function AvatarGrid({ engagementAvg }: AvatarGridProps) {
  const members = buildGrid(engagementAvg);

  return (
    <div className="grid grid-cols-6 gap-3 p-4">
      {members.map((m) => (
        <div
          key={m.id}
          className={cn(
            "aspect-square rounded-full bg-gray-700 flex items-center justify-center",
            RING[m.level]
          )}
        >
          <span className="text-[10px] text-gray-400 select-none">{m.id + 1}</span>
        </div>
      ))}
    </div>
  );
}
