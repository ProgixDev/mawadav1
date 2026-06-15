import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Strict Mode is on by default in the App Router; set explicitly to keep it
  // pinned for the future.
  reactStrictMode: true,

  // Don't advertise the framework on every response (small payload + security).
  poweredByHeader: false,

  // Security headers applied to every route. They cost nothing at runtime and
  // are required for a production-grade deployment.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
