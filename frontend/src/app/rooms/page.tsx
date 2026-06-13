"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Terminal, Sofa, Presentation, MessageSquare, Loader2, type LucideIcon } from "lucide-react";
import { AuthedLayout } from "@/components/layout/AuthedLayout";
import { createSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AudienceProfile } from "@/types";

interface RoomDef {
  value: AudienceProfile;
  label: string;
  code: string;
  description: string;
  icon: LucideIcon;
  accent: React.ReactNode;
}

const ROOMS: RoomDef[] = [
  {
    value: "technical",
    label: "Technical",
    code: "GRID / 01",
    description: "Whiteboard session. Precise, engineered, focused on clarity.",
    icon: Terminal,
    accent: (
      <div className="mt-4 h-[2px] w-full rounded-full bg-er-surface-3">
        <div className="h-full w-[60%] rounded-full bg-er-blue" />
      </div>
    ),
  },
  {
    value: "interview",
    label: "Interview",
    code: "FOCUS / 02",
    description: "Composed & Evaluative. Quiet, serious, professional.",
    icon: Sofa,
    accent: (
      <div className="mt-4 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-er-ink-4" />
        ))}
      </div>
    ),
  },
  {
    value: "presentation",
    label: "Presentation",
    code: "STAGE / 03",
    description: "The Big Stage. Expansive, dramatic, sense of size.",
    icon: Presentation,
    accent: (
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-24 w-40 rounded-bl-lg"
        style={{
          background: "radial-gradient(ellipse at 100% 100%, #f3f4f5 0%, transparent 70%)",
        }}
      />
    ),
  },
  {
    value: "general",
    label: "General",
    code: "FLOW / 04",
    description: "Human Conversation. Warm, unguarded, connected.",
    icon: MessageSquare,
    accent: null,
  },
];

export default function RoomsPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<AudienceProfile | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!selected) return;
    if (!sessionName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setApiError(false);
    setLoading(true);
    try {
      const session = await createSession(sessionName.trim(), selected);
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error("[EchoRoom] Failed to create session:", err);
      setApiError(true);
      setLoading(false);
    }
  };

  return (
    <AuthedLayout>
      {/* Page header */}
      <div className="mx-auto max-w-[800px] pt-12 text-center">
        <h1 className="font-display text-[40px] font-bold text-er-ink">
          Choose your context.
        </h1>
        <p className="mx-auto mt-3 max-w-[560px] font-sans text-[16px] text-er-ink-2">
          The AI coach will adapt its feedback based on the psychological
          environment of your practice.
        </p>
      </div>

      {/* Session name */}
      <div className="mx-auto mt-8 max-w-[480px]">
        <label className="mb-1.5 block font-label text-[13px] font-medium uppercase tracking-widest text-er-ink-3">
          Session name
        </label>
        <input
          type="text"
          value={sessionName}
          onChange={(e) => { setSessionName(e.target.value); if (nameError && e.target.value.trim()) setNameError(false); }}
          placeholder="Q3 Architecture Review"
          className={cn(
            "h-11 w-full rounded-lg border bg-er-surface px-4 font-sans text-[15px] text-er-ink placeholder:text-er-ink-4 transition-colors focus:outline-none",
            nameError
              ? "border-er-red focus:border-er-red"
              : "border-er-border focus:border-er-blue"
          )}
        />
        {nameError && (
          <p className="mt-1.5 font-sans text-[13px] text-er-red">
            Please name your session to continue.
          </p>
        )}
        {apiError && (
          <p className="mt-1.5 font-sans text-[13px] text-er-red">
            Could not start session. Is the backend running?
          </p>
        )}
      </div>

      {/* Room cards */}
      <div className="mx-auto mt-10 max-w-[960px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ROOMS.map((room) => {
            const Icon = room.icon;
            const isSelected = selected === room.value;
            return (
              <button
                key={room.value}
                onClick={() => setSelected(room.value)}
                className={cn(
                  "relative overflow-hidden rounded-lg border p-6 text-left transition-all duration-150",
                  isSelected
                    ? "border-er-blue bg-[rgba(0,79,218,0.04)]"
                    : "border-er-border bg-er-surface hover:border-er-border-2 hover:shadow-sm"
                )}
              >
                {/* Header row */}
                <div className="flex items-start justify-between">
                  <Icon
                    size={20}
                    className={isSelected ? "text-er-blue" : "text-er-ink-3"}
                  />
                  <span className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
                    {room.code}
                  </span>
                </div>

                {/* Room name */}
                <p className="mt-3 font-display text-[20px] font-semibold text-er-ink">
                  {room.label}
                </p>

                {/* Description */}
                <p className="mt-2 max-w-[320px] font-sans text-[14px] text-er-ink-2">
                  {room.description}
                </p>

                {/* Accent element */}
                {room.accent}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start button */}
      <div className="mx-auto mt-8 max-w-[960px] pb-16 text-center">
        <button
          onClick={() => void handleStart()}
          disabled={!selected || loading}
          className={cn(
            "inline-flex h-12 items-center gap-2 rounded-lg px-8 font-label text-[14px] font-medium uppercase tracking-wide transition-all",
            selected && !loading
              ? "bg-er-ink text-white hover:opacity-90"
              : "cursor-not-allowed bg-er-surface-3 text-er-ink-3"
          )}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Starting…
            </>
          ) : selected ? (
            "Start Session →"
          ) : (
            "Select a context"
          )}
        </button>
      </div>
    </AuthedLayout>
  );
}
