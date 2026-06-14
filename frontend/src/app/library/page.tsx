"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, RefreshCw } from "lucide-react";
import { AuthedLayout } from "@/components/layout/AuthedLayout";
import { getSessions, deleteSession } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Session, AudienceProfile } from "@/types";

const PAGE_SIZE = 9;

const FILTER_TABS: { value: AudienceProfile | "all"; label: string }[] = [
  { value: "all",          label: "All Contexts" },
  { value: "technical",    label: "Technical" },
  { value: "interview",    label: "Interview" },
  { value: "presentation", label: "Presentation" },
  { value: "general",      label: "General" },
];

function roomLabel(profile: string): string {
  const map: Record<string, string> = {
    technical:    "Technical",
    interview:    "Interview",
    presentation: "Presentation",
    general:      "General",
  };
  return map[profile] ?? profile;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SessionCard({
  session,
  onDelete,
}: {
  session: Session;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  return (
    <div
      onClick={() => router.push(`/report/${session.id}`)}
      className="group relative cursor-pointer rounded border border-er-border bg-er-surface p-5 transition-all hover:border-er-border-2 hover:shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded border border-er-border bg-er-surface-2 px-2 py-0.5 font-label text-[12px] font-medium uppercase tracking-wide text-er-ink-3">
            {roomLabel(session.audience_profile)}
          </span>
          <span className="font-sans text-[13px] text-er-ink-3">
            &middot; {formatDate(session.created_at)}
          </span>
        </div>

        {/* Three-dot menu */}
        <div ref={menuRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="flex h-7 w-7 items-center justify-center rounded text-er-ink-3 transition-colors hover:bg-er-surface-2 hover:text-er-ink"
            aria-label="Session options"
          >
            ⋮
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded border border-er-border bg-er-surface shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  router.push(`/report/${session.id}`);
                }}
                className="flex w-full items-center px-4 py-2.5 font-sans text-[14px] text-er-ink transition-colors hover:bg-er-surface-2"
              >
                View Report
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(session.id);
                }}
                className="flex w-full items-center px-4 py-2.5 font-sans text-[14px] text-er-red transition-colors hover:bg-er-surface-2"
              >
                Delete Session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Session name */}
      <p className="mt-3 font-display text-[18px] font-semibold text-er-ink transition-colors line-clamp-2 group-hover:text-er-blue">
        {session.name ?? `${roomLabel(session.audience_profile)} Session`}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-6">
        <div>
          <p className="font-label text-[11px] font-medium uppercase tracking-widest text-er-ink-3">Score</p>
          <p className="mt-0.5 font-display text-[18px] font-semibold text-er-ink">
            {session.overall_score !== null ? session.overall_score : "—"}
            <span className="font-sans text-[14px] font-normal text-er-ink-3"> / 100</span>
          </p>
        </div>
        <div>
          <p className="font-label text-[11px] font-medium uppercase tracking-widest text-er-ink-3">Duration</p>
          <p className="mt-0.5 font-display text-[18px] font-semibold text-er-ink">
            {formatDuration(session.duration_seconds)}
          </p>
        </div>
        <div className="ml-auto">
          <ArrowRight size={16} className="text-er-ink-3 transition-colors group-hover:text-er-ink" />
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AudienceProfile | "all">("all");
  const [sort, setSort] = useState<"recent" | "oldest" | "score">("recent");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getSessions()
      .then((res) => setSessions(res.sessions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("[EchoRoom] Failed to delete session:", err);
    }
  };

  const filtered = sessions
    .filter((s) => {
      if (filter !== "all" && s.audience_profile !== filter) return false;
      if (search) {
        const term = search.toLowerCase();
        const name = (s.name ?? s.audience_profile).toLowerCase();
        return name.includes(term);
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === "score")
        return (b.overall_score ?? -1) - (a.overall_score ?? -1);
      if (sort === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  return (
    <AuthedLayout>
      {/* Header */}
      <div className="flex flex-col gap-4 pt-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[36px] font-bold text-er-ink">
            Session Library
          </h1>
          <p className="mt-1 font-sans text-[16px] text-er-ink-2">
            Review past sessions and revisit coaching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-er-ink-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search sessions…"
              className="h-10 w-[280px] rounded border border-er-border bg-er-surface pl-9 pr-3 font-label text-[14px] text-er-ink placeholder:text-er-ink-4 focus:border-er-blue focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setFilter(tab.value); setPage(1); }}
            className={cn(
              "h-8 rounded px-4 font-label text-[14px] font-medium transition-colors",
              filter === tab.value
                ? "bg-er-btn-bg text-er-btn-text"
                : "border border-er-border bg-er-surface text-er-ink-2 hover:border-er-border-2 hover:text-er-ink"
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "oldest" | "score")}
            className="h-8 rounded border border-er-border bg-er-surface px-3 font-label text-[14px] text-er-ink-2 focus:outline-none"
          >
            <option value="recent">Recent First ▾</option>
            <option value="oldest">Oldest First ▾</option>
            <option value="score">Score ▾</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <p className="col-span-3 py-16 text-center font-sans text-[14px] text-er-ink-3">
            Loading sessions…
          </p>
        ) : visible.length === 0 ? (
          <p className="col-span-3 py-16 text-center font-sans text-[14px] text-er-ink-3">
            No sessions found.
          </p>
        ) : (
          <>
            {visible.map((s) => (
              <SessionCard key={s.id} session={s} onDelete={handleDelete} />
            ))}
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded border-2 border-dashed border-er-border text-er-ink-3 transition-colors hover:border-er-border-2 hover:text-er-ink"
              >
                <RefreshCw size={20} />
                <span className="font-label text-[13px] uppercase tracking-wide">
                  Load More Sessions
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </AuthedLayout>
  );
}
