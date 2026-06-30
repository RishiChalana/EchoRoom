"use client"
import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-er-bg">
          <div className="text-center">
            <h2 className="font-display text-2xl font-semibold text-er-ink mb-2">
              Something went wrong
            </h2>
            <p className="text-er-ink-2 mb-6">
              We&apos;ve been notified and are looking into it.
            </p>
            <button
              onClick={() => (window.location.href = "/")}
              className="bg-er-btn-bg text-er-btn-text px-6 py-3 rounded-lg font-medium"
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
