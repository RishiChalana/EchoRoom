"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { useSession } from "@/hooks/useSession";
import { AvatarGrid } from "@/components/session/AvatarGrid";
import { MetricsSidebar } from "@/components/session/MetricsSidebar";
import { TranscriptPane } from "@/components/session/TranscriptPane";
import { SessionControls } from "@/components/session/SessionControls";

interface PageProps {
  params: { id: string };
}

export default function SessionPage({ params }: PageProps) {
  const router = useRouter();
  const {
    session,
    engagementAvg,
    clarityAvg,
    latestTranscript,
    transcriptHistory,
    endSession,
    resetSession,
  } = useAppStore();

  const { sendAudio } = useSession(params.id);

  const handleEnd = useCallback(async () => {
    try {
      await endSession(params.id);
      router.push(`/report/${params.id}`);
    } catch (err) {
      console.error("[EchoRoom] Failed to end session:", err);
    }
  }, [params.id, endSession, router]);

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-500">Loading session…</p>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white">
            Echo<span className="text-brand-500">Room</span>
          </h1>
          <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-xs text-brand-500">
            {session.audience_profile}
          </span>
        </div>
        <span className="text-xs text-gray-600">
          {params.id.slice(0, 8)}&hellip;
        </span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Audience */}
          <div className="border-b border-gray-800">
            <AvatarGrid engagementAvg={engagementAvg} />
          </div>

          {/* Transcript */}
          <TranscriptPane transcript={transcriptHistory} latestText={latestTranscript} />

          {/* Controls */}
          <SessionControls session={session} onEnd={() => void handleEnd()} sendAudio={sendAudio} />
        </div>

        {/* Metrics */}
        <MetricsSidebar engagementAvg={engagementAvg} clarityAvg={clarityAvg} />
      </div>
    </main>
  );
}
