"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Mail, Lock } from "lucide-react";

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-er-bg px-4">
      <div className="w-full max-w-[480px]">
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <Image src="/logo.png" alt="EchoRoom" width={48} height={48} className="h-12 w-12" />
          </div>
          <h1 className="font-display text-[40px] font-bold text-er-ink">EchoRoom</h1>
          <p className="mt-2 font-sans text-[16px] text-er-ink-2">
            Sign in to your studio space.
          </p>
        </div>

        <div className="rounded-lg border border-er-border bg-er-surface p-8">
          {/* OAuth buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
              className="flex h-11 w-full items-center justify-center gap-4 rounded-lg border border-er-border-2 bg-er-surface font-sans text-[15px] font-medium text-er-ink transition-colors hover:border-er-ink-3 hover:bg-er-surface-2"
            >
              <GoogleLogo />
              Continue with Google
            </button>
            <button
              onClick={() => void signIn("github", { callbackUrl: "/dashboard" })}
              className="flex h-11 w-full items-center justify-center gap-4 rounded-lg border border-er-border-2 bg-er-surface font-sans text-[15px] font-medium text-er-ink transition-colors hover:border-er-ink-3 hover:bg-er-surface-2"
            >
              <GitHubLogo />
              Continue with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-er-border" />
            <span className="font-sans text-[13px] text-er-ink-4">or</span>
            <div className="h-px flex-1 bg-er-border" />
          </div>

          {/* Email/password — disabled, coming soon */}
          <fieldset disabled className="space-y-4 opacity-50">
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-er-ink-3"
              />
              <input
                type="email"
                placeholder="Email address"
                className="h-11 w-full cursor-not-allowed border-b border-er-border-2 bg-transparent pl-9 font-sans text-[15px] text-er-ink placeholder:text-er-ink-4 focus:outline-none"
                title="Email sign-in coming soon"
              />
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-er-ink-3"
              />
              <input
                type="password"
                placeholder="Password"
                className="h-11 w-full cursor-not-allowed border-b border-er-border-2 bg-transparent pl-9 font-sans text-[15px] text-er-ink placeholder:text-er-ink-4 focus:outline-none"
                title="Email sign-in coming soon"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex cursor-not-allowed items-center gap-2 font-sans text-[14px] text-er-ink-2">
                <input type="checkbox" className="rounded" disabled />
                Remember me
              </label>
              <button
                type="button"
                disabled
                className="cursor-not-allowed font-sans text-[14px] text-er-blue-text"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="button"
              disabled
              className="h-11 w-full cursor-not-allowed rounded-lg bg-er-btn-bg font-sans text-[15px] font-medium text-er-btn-text opacity-40"
              title="Email sign-in coming soon"
            >
              Sign In
            </button>
          </fieldset>
        </div>

        <p className="mt-6 text-center font-sans text-[14px] text-er-ink-3">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-er-blue transition-colors hover:text-er-blue-2">
            Sign up →
          </Link>
        </p>
      </div>
    </div>
  );
}
