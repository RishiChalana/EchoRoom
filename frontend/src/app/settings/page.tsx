"use client";

import { signOut } from "next-auth/react";
import { AuthedLayout } from "@/components/layout/AuthedLayout";

function SettingsSection({ heading, children }: { heading: string; children?: React.ReactNode }) {
  return (
    <div className="rounded border border-er-border bg-er-surface p-5">
      <h2 className="font-display text-[18px] font-semibold text-er-ink">{heading}</h2>
      <p className="mt-2 font-sans text-[14px] text-er-ink-3">
        {children ?? "Settings coming in a future update."}
      </p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthedLayout>
      <div className="pt-12 pb-16">
        <h1 className="font-display text-[32px] font-bold text-er-ink">Settings</h1>

        <div className="mt-8 space-y-4 max-w-[640px]">
          <SettingsSection heading="Profile" />
          <SettingsSection heading="Notifications" />
          <SettingsSection heading="Privacy" />
        </div>

        <div className="mt-10">
          <button
            onClick={() => void signOut({ callbackUrl: "/" })}
            className="flex h-10 items-center rounded-lg border border-er-border px-5 font-sans text-[14px] text-er-ink-2 transition-colors hover:border-er-border-2 hover:text-er-ink"
          >
            Sign Out
          </button>
        </div>
      </div>
    </AuthedLayout>
  );
}
