"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import { useSession as useWSSession } from "@/hooks/useSession";
import type { TranscriptChunk } from "@/types";

interface PageProps {
  params: { id: string };
}

// ── Session timer (starts only when recording) ────────────────────────────────
function useTimer(isRunning: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!isRunning) return;
    const start = Date.now() - elapsedRef.current * 1000;
    const id = setInterval(() => {
      const val = Math.floor((Date.now() - start) / 1000);
      elapsedRef.current = val;
      setElapsed(val);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
  const s = (elapsed % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ── Engagement label ──────────────────────────────────────────────────────────
function engagementLabel(avg: number | null): { label: string; color: string } {
  if (avg === null) return { label: "READY", color: "#888888" };
  if (avg > 0.66) return { label: "FLOW STATE", color: "#4ade80" };
  if (avg >= 0.4) return { label: "ENGAGED", color: "#f59e0b" };
  return { label: "BUILDING", color: "#888888" };
}

// ── Transcript area ───────────────────────────────────────────────────────────
function TranscriptArea({
  history,
  latestText,
}: {
  history: TranscriptChunk[];
  latestText: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, latestText]);

  const isEmpty = history.length === 0 && !latestText;

  return (
    <div
      className="transcript-mask absolute inset-0 overflow-y-auto px-[10%] pb-[120px] pt-[100px]"
      aria-live="polite"
      aria-label="Transcript"
    >
      {isEmpty ? (
        <p className="flex h-full items-center justify-center font-sans text-[16px] text-[#444444]">
          Begin recording to start transcription.
        </p>
      ) : (
        <div className="space-y-4">
          {history.map((chunk, i) => {
            const isLast = i === history.length - 1 && !latestText;
            return (
              <div key={chunk.chunk_id} className="flex items-start gap-4">
                <span className="mt-0.5 shrink-0 font-mono text-[13px] text-[#444444]">
                  {Math.floor(i * 3 / 60).toString().padStart(2, "0")}:
                  {((i * 3) % 60).toString().padStart(2, "0")}
                </span>
                <p
                  className={
                    isLast
                      ? "border-l-2 border-er-dark-blue pl-3 font-sans text-[20px] leading-[1.8] text-[#d4d4d4]"
                      : "font-sans text-[20px] leading-[1.8] text-[#888888]"
                  }
                >
                  {chunk.text}
                </p>
              </div>
            );
          })}
          {latestText && (
            <div className="flex items-start gap-4">
              <span className="mt-0.5 shrink-0 font-mono text-[13px] text-[#444444]">
                {Math.floor(history.length * 3 / 60).toString().padStart(2, "0")}:
                {((history.length * 3) % 60).toString().padStart(2, "0")}
              </span>
              <p className="border-l-2 border-er-dark-blue pl-3 font-sans text-[20px] leading-[1.8] text-[#d4d4d4]">
                {latestText}
              </p>
            </div>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Recording controls ────────────────────────────────────────────────────────
function Controls({
  recording,
  onToggleRecording,
  onEnd,
}: {
  recording: boolean;
  onToggleRecording: () => void;
  onEnd: () => void;
}) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEndClick = () => {
    if (confirmEnd) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      onEnd();
    } else {
      setConfirmEnd(true);
      confirmTimer.current = setTimeout(() => setConfirmEnd(false), 3000);
    }
  };

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  return (
    <div
      className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-6"
      style={{ height: 56 }}
    >
      <button
        onClick={onToggleRecording}
        className="flex h-9 items-center gap-2 rounded-lg border border-[#3a3a3a] bg-[#2a2a2a] px-4 font-label text-[14px] font-medium uppercase tracking-wide text-[#f0f0f0] transition-colors hover:bg-[#333333]"
      >
        {recording ? "⏸ PAUSE" : "● RECORD"}
      </button>

      <button
        onClick={handleEndClick}
        className={`flex h-9 items-center gap-2 rounded-lg px-4 font-label text-[14px] font-medium uppercase tracking-wide text-white transition-all ${
          confirmEnd
            ? "bg-[#cc2200] ring-2 ring-[#ef4444]/40"
            : "bg-[#ef4444] hover:bg-[#cc2200]"
        }`}
      >
        {confirmEnd ? "CONFIRM →" : "□ END SESSION"}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SessionPage({ params }: PageProps) {
  const router = useRouter();
  const {
    session,
    loadSession,
    endSession,
    engagementAvg,
    transcriptHistory,
    latestTranscript,
  } = useAppStore();
  const { sendAudio } = useWSSession(params.id);

  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timer = useTimer(recording);

  useEffect(() => {
    if (!session || session.id !== params.id) {
      loadSession(params.id).catch((err) =>
        console.error("[EchoRoom] Failed to load session:", err)
      );
    }
  }, [params.id, session, loadSession]);

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) void e.data.arrayBuffer().then(sendAudio);
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(true);
  }, [sendAudio]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  const handleEnd = useCallback(async () => {
    stopRecording();
    try {
      await endSession(params.id);
      router.push(`/report/${params.id}`);
    } catch (err) {
      console.error("[EchoRoom] Failed to end session:", err);
    }
  }, [params.id, endSession, router, stopRecording]);

  const { label: engLabel, color: engColor } = engagementLabel(engagementAvg);

  return (
    <div
      className="relative h-screen overflow-hidden"
      style={{ background: "var(--er-dark-bg)" }}
    >
      {/* Top pill */}
      <div className="fixed left-1/2 top-5 z-30 flex -translate-x-1/2 items-center gap-0 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-5"
        style={{ height: 44 }}>
        {/* Recording indicator */}
        <div className="flex items-center gap-2 pr-4">
          <span
            className={recording ? "animate-rec-pulse h-2 w-2 rounded-full bg-[#ef4444]" : "h-2 w-2 rounded-full bg-[#444444]"}
          />
          <span className="font-label text-[12px] font-medium uppercase tracking-wide text-[#f0f0f0]">
            {recording ? "RECORDING" : "READY"}
          </span>
        </div>

        <div className="mx-3 h-4 w-px bg-[#2a2a2a]" />

        {/* Timer */}
        <span className="font-mono text-[14px] text-[#888888]">{timer}</span>

        <div className="mx-3 h-4 w-px bg-[#2a2a2a]" />

        {/* Engagement */}
        <span className="font-label text-[12px] font-medium uppercase tracking-wide" style={{ color: engColor }}>
          {engLabel}
        </span>
      </div>

      {/* Transcript */}
      <TranscriptArea
        history={transcriptHistory}
        latestText={latestTranscript}
      />

      {/* Bottom controls */}
      <Controls
        recording={recording}
        onToggleRecording={toggleRecording}
        onEnd={() => void handleEnd()}
      />
    </div>
  );
}
