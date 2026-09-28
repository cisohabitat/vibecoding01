import type { NextConfig } from "next";

// The Content-Security-Policy is set per request with a nonce in proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // HTTPS only for two years (browsers ignore it over plain HTTP, e.g. local
  // e2e). No includeSubDomains: other subdomains of a custom domain aren't ours.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  // Pages opened from here (all external links are noopener anyway) can't
  // reach back into this window
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
