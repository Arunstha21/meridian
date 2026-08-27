import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Sure exports can be larger than Next's default 1 MB Server Action body.
    // The importer separately enforces its 25 MB archive and 32 MB extracted-data caps.
    serverActions: { bodySizeLimit: "26mb" }
  },
  turbopack: {
    root: __dirname
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/api/export",
        headers: [{ key: "Cache-Control", value: "no-store, private" }]
      }
    ];
  }
};

export default nextConfig;
