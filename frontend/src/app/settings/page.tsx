"use client";

import { signOut } from "next-auth/react";
import { AuthedLayout } from "@/components/layout/AuthedLayout";
import { useTheme } from "@/components/layout/ThemeProvider";

function SettingsSection({ heading, children }: { heading: string; children?: React.ReactNode }) {
  return (
    <div className="rounded border border-er-border bg-er-surface p-5">
      <h2 className="font-display text-[18px] font-semibold text-er-ink">{heading}</h2>
      {children ?? (
        <p className="mt-2 font-sans text-[14px] text-er-ink-3">
          Settings coming in a future update.
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <AuthedLayout>
      <div className="pt-12 pb-16">
        <h1 className="font-display text-[32px] font-bold text-er-ink">Settings</h1>

        <div className="mt-8 max-w-[640px] space-y-4">
          <SettingsSection heading="Appearance">
            <div className="mt-4 flex items-center justify-between border-b border-er-border py-4">
              <div>
                <p className="font-sans text-[15px] font-medium text-er-ink">Dark mode</p>
                <p className="mt-0.5 font-sans text-[13px] text-er-ink-2">
                  Switch between light and dark interface
                </p>
              </div>
              <button
                onClick={toggleTheme}
                role="switch"
                aria-checked={theme === "dark"}
                aria-label="Toggle dark mode"
                className={`relative h-6 w-12 rounded-full transition-colors duration-200 ${
                  theme === "dark" ? "bg-er-blue" : "bg-er-border-2"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    theme === "dark" ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </SettingsSection>

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
