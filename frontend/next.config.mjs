/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.INTERNAL_API_URL ?? "http://localhost:8000"}/api/v1/:path*`,
      },
    ];
  },

  reactStrictMode: true,
};

export default nextConfig;