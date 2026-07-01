"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Clock, Flame, Brain } from "lucide-react";
import { AuthedLayout } from "@/components/layout/AuthedLayout";
import { getSessions, updateUserName } from "@/lib/api";
import type { Session } from "@/types";

function formatTotalTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function roomLabel(profile: string): string {
  const map: Record<string, string> = {
    technical:    "Technical",
    interview:    "Interview",
    presentation: "Presentation",
    general:      "General",
  };
  return map[profile] ?? profile;
}

function Initials({ name, size = 120 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-er-surface-4 font-display font-bold text-er-ink-2"
      style={{ width: size, height: size, fontSize: size * 0.33 }}
    >
      {letters}
    </div>
  );
}

export default function ProfilePage() {
  const { data: authSession } = useSession();
  const user = authSession?.user;
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Inline name edit ────────────────────────────────────────────────────────
  // NextAuth session.user.name reflects the value at login time (from the
  // OAuth provider or CredentialsProvider authorize() return value), not the DB.
  // After a successful PATCH we update displayName locally so the UI reflects
  // the change immediately without requiring a full session refresh.
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState<string>(user?.name ?? "");
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync displayName when user loads from NextAuth
  useEffect(() => {
    if (user?.name && !displayName) setDisplayName(user.name);
  }, [user?.name, displayName]);

  const handleEditName = () => {
    setNameInput(displayName);
    setNameError(null);
    setEditingName(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleCancelName = () => {
    setEditingName(false);
    setNameError(null);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setNameSaving(true);
    setNameError(null);
    try {
      const updated = await updateUserName(nameInput.trim());
      setDisplayName(updated.name ?? nameInput.trim());
      setEditingName(false);
    } catch {
      setNameError("Failed to save. Please try again.");
    } finally {
      setNameSaving(false);
    }
  };

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
  const sessionCount = sessions.length;

  const mostUsedRoom = (() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      counts[s.audience_profile] = (counts[s.audience_profile] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();

  return (
    <AuthedLayout>
      {/* Profile header */}
      <div className="flex flex-col gap-6 pt-12 sm:flex-row sm:items-center">
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name ?? "Avatar"}
            width={120}
            height={120}
            className="rounded-full"
          />
        ) : (
          <Initials name={user?.name ?? "U"} />
        )}
        <div>
          {/* Name display / edit */}
          {editingName ? (
            <div className="flex flex-col gap-2">
              <input
                ref={inputRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveName();
                  if (e.key === "Escape") handleCancelName();
                }}
                className="w-full rounded border border-er-border px-3 py-1.5 font-display text-[24px] font-bold text-er-ink bg-er-surface focus:border-er-blue focus:outline-none"
                style={{ borderRadius: 4 }}
              />
              {nameError && (
                <p className="font-sans text-[13px] text-er-red">{nameError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => void handleSaveName()}
                  disabled={nameSaving}
                  className="rounded-lg bg-er-btn-bg px-4 py-1.5 font-sans text-[13px] font-medium text-er-btn-text disabled:opacity-60"
                >
                  {nameSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleCancelName}
                  className="font-sans text-[13px] text-er-ink-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="font-display text-[32px] font-bold text-er-ink">
                {displayName || user?.name || "Your Profile"}
              </h1>
              <button
                onClick={handleEditName}
                className="font-sans text-[13px] text-er-ink-3 hover:text-er-ink"
              >
                Edit
              </button>
            </div>
          )}
          {mostUsedRoom && (
            <div className="mt-2 flex gap-2">
              <span className="rounded border border-er-border bg-er-surface-2 px-3 py-1 font-label text-[13px] text-er-ink-2">
                {roomLabel(mostUsedRoom)} Practitioner
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border border-er-border bg-er-surface p-5">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-er-ink-3" />
            <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
              Total Practice Time
            </p>
          </div>
          <p className="mt-3 font-display text-[32px] font-bold text-er-ink">
            {loading ? "—" : formatTotalTime(totalSeconds)}
          </p>
          <p className="mt-1 font-sans text-[14px] text-er-ink-3">
            Across {sessionCount} recorded sessions.
          </p>
        </div>

        <div className="rounded border border-er-border bg-er-surface p-5">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-er-amber" />
            <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
              Current Streak
            </p>
          </div>
          <p className="mt-3 font-display text-[32px] font-bold text-er-ink">
            {loading ? "—" : `${sessionCount} Sessions`}
          </p>
          <p className="mt-1 font-sans text-[14px] text-er-ink-3">
            Keep practicing daily to build a streak.
          </p>
        </div>

        <div className="rounded border border-er-border bg-er-surface p-5">
          <div className="flex items-center gap-2">
            <Brain size={16} className="text-er-blue" />
            <p className="font-label text-[12px] font-medium uppercase tracking-widest text-er-ink-3">
              Communication Identity
            </p>
          </div>
          <p className="mt-3 font-display text-[32px] font-bold text-er-ink">Your Style</p>
          <p className="mt-1 font-sans text-[14px] text-er-ink-3">
            Complete 3 sessions to unlock your communication profile.
          </p>
        </div>
      </div>

      {/* Two-column insights */}
      <div className="mt-10 grid grid-cols-1 gap-6 pb-16 lg:grid-cols-2">
        {/* Key strengths */}
        <div>
          <h2 className="font-display text-[20px] font-semibold text-er-ink">
            Key Strengths
          </h2>
          <div className="mt-4">
            {sessions.length === 0 ? (
              <p className="font-sans text-[15px] italic text-er-ink-3">
                Complete sessions to discover your strengths.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3 rounded border border-er-border bg-er-surface p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-er-surface-2 font-sans text-[16px]">
                    💬
                  </div>
                  <div>
                    <p className="font-sans text-[15px] font-medium text-er-ink">
                      Consistent Practice
                    </p>
                    <p className="mt-0.5 font-sans text-[14px] text-er-ink-2">
                      You&apos;ve completed {sessionCount} sessions across{" "}
                      {Object.keys(
                        sessions.reduce<Record<string, boolean>>((acc, s) => {
                          acc[s.audience_profile] = true;
                          return acc;
                        }, {})
                      ).length}{" "}
                      room types.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Focus areas */}
        <div>
          <h2 className="font-display text-[20px] font-semibold text-er-ink">
            Current Focus Areas
          </h2>
          <div className="mt-4">
            {sessions.length === 0 ? (
              <p className="font-sans text-[15px] italic text-er-ink-3">
                Your focus areas appear after your first session.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded border border-er-border bg-er-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-[15px] font-medium text-er-ink">
                      Communication Clarity
                    </p>
                    <span className="font-label text-[12px] text-er-ink-3">In Progress</span>
                  </div>
                  <p className="mt-1 font-sans text-[14px] text-er-ink-2">
                    Keep practicing to improve clarity and reduce filler words.
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-er-surface-3">
                    <div className="h-full w-[40%] rounded-full bg-er-blue" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthedLayout>
  );
}
