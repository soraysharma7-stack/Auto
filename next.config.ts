import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow local browser tests and Arena's browser preview in development.
  allowedDevOrigins: ["127.0.0.1", "localhost", "*.e2b.app"],
  // Keep the framework badge from covering product navigation in the live preview.
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(process.env.NODE_ENV === "production" ? [
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          ] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
