import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.INTERNAL_API_URL ?? "http://localhost:8000"}/api/v1/:path*`,
      },
    ]
  },

  reactStrictMode: true,
}

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
