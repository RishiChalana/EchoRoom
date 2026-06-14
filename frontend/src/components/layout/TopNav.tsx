"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Bell, Settings, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/rooms",     label: "Rooms" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/library",   label: "Library" },
  { href: "/profile",   label: "Profile" },
];

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-er-surface-4 font-label text-[13px] font-medium text-er-ink-2 select-none">
      {letters}
    </div>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { data: sessionData } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const user = sessionData?.user;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-er-border bg-er-surface">
      <div className="mx-auto flex h-full max-w-container items-center justify-between px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <span className="font-display text-[17px] font-semibold tracking-tight text-er-ink">
            EchoRoom
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-6">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative pb-[2px] text-[15px] font-medium transition-colors",
                  active
                    ? "text-er-blue after:absolute after:bottom-[-14px] after:left-0 after:right-0 after:h-[2px] after:bg-er-blue after:content-['']"
                    : "text-er-ink-2 hover:text-er-ink"
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <Link
            href="/notifications"
            className="flex h-8 w-8 items-center justify-center rounded text-er-ink-3 transition-colors hover:text-er-ink"
            aria-label="Notifications"
          >
            <Bell size={20} />
          </Link>
          <Link
            href="/settings"
            className="flex h-8 w-8 items-center justify-center rounded text-er-ink-3 transition-colors hover:text-er-ink"
            aria-label="Settings"
          >
            <Settings size={20} />
          </Link>

          {/* Avatar dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1 rounded transition-opacity hover:opacity-80"
              aria-expanded={dropdownOpen}
              aria-label="Account menu"
            >
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "Avatar"}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <Initials name={user?.name ?? "U"} />
              )}
              <ChevronDown size={14} className="text-er-ink-3" />
            </button>

            {dropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[140px] rounded-lg border border-er-border bg-er-surface shadow-md">
                  <Link
                    href="/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2.5 text-[14px] text-er-ink-2 transition-colors hover:bg-er-surface-2 hover:text-er-ink"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => void signOut({ callbackUrl: "/" })}
                    className="block w-full px-4 py-2.5 text-left text-[14px] text-er-ink-2 transition-colors hover:bg-er-surface-2 hover:text-er-ink"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
