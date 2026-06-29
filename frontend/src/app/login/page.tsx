"use client";

import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
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


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  };

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
          <button
            onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
            className="flex h-11 w-full items-center justify-center gap-4 rounded-lg border border-er-border-2 bg-er-surface font-sans text-[15px] font-medium text-er-ink transition-colors hover:border-er-ink-3 hover:bg-er-surface-2"
          >
            <GoogleLogo />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-er-border" />
            <span className="font-sans text-[13px] text-er-ink-4">or</span>
            <div className="h-px flex-1 bg-er-border" />
          </div>

          {/* Email/password form */}
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-er-ink-3"
              />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full border-b border-er-border-2 bg-transparent pl-9 font-sans text-[15px] text-er-ink placeholder:text-er-ink-4 focus:outline-none"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11 w-full border-b border-er-border-2 bg-transparent pl-9 font-sans text-[15px] text-er-ink placeholder:text-er-ink-4 focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-[13px] text-er-red mt-2">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 font-sans text-[14px] text-er-ink-2">
                <input type="checkbox" className="rounded" />
                Remember me
              </label>
              <button
                type="button"
                className="font-sans text-[14px] text-er-blue-text"
              >
                Forgot password?
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-er-btn-bg font-sans text-[15px] font-medium text-er-btn-text transition-opacity disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
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
