import { NextRequest, NextResponse } from "next/server";

/**
 * Per-request nonce-based Content-Security-Policy for HTML pages.
 *
 * Next.js reads the nonce from the request's CSP header and attaches it to
 * its own inline and bundle scripts, so script-src needs no 'unsafe-inline'.
 * 'strict-dynamic' lets those nonced scripts load others (Vercel Analytics /
 * Speed Insights inject theirs from JS). Pages must render dynamically for
 * this (see app/layout.tsx); article data is still cached (lib/pipeline.ts).
 *
 * style-src keeps 'unsafe-inline': the UI uses inline style attributes, and
 * a nonce would disable 'unsafe-inline' for those.
 */
export function buildCsp(nonce: string, isDev = process.env.NODE_ENV === "development"): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: skip API routes, build assets and metadata files
      source:
        "/((?!api|_next/static|_next/image|icon.svg|opengraph-image|manifest.webmanifest|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
