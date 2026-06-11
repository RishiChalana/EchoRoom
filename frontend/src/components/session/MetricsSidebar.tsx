"use client";

import { Gauge } from "@/components/ui/Gauge";

interface MetricsSidebarProps {
  engagementAvg: number | null;
  clarityAvg: number | null;
}

export function MetricsSidebar({ engagementAvg, clarityAvg }: MetricsSidebarProps) {
  return (
    <aside className="flex w-44 flex-col gap-6 border-l border-gray-800 p-4">
      <Gauge value={engagementAvg ?? 0} label="Engagement" color="#4f6ef7" />
      <Gauge value={clarityAvg ?? 0} label="Clarity" color="#10b981" />
      <p className="mt-auto text-center text-xs text-gray-700">Live · updates in real-time</p>
    </aside>
  );
}
