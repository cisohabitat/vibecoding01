import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";
import { getKevIds } from "@/lib/kev";

// A cold data cache runs the whole pipeline: worst case ~25s (10s feed
// timeout + retry, then NVD). Don't rely on the platform's default limit.
export const maxDuration = 60;

// Rendered per request (ISR's stale-while-revalidate would hand a monitor
// the *previous* check's result). Checking fetches every feed, so results
// are memoised for 60s per instance; the CDN may cache a response only for
// the memo's remaining lifetime, so a result is never more than ~60s old.
export const dynamic = "force-dynamic";

const TTL_MS = 60_000;

interface Health {
  status: "ok" | "degraded" | "down";
  feedsUp: number;
  feedsDown: number;
  /** Names of the feeds that failed (already public via /api/feed.json) */
  failedFeeds: string[];
  /** Whether the CISA KEV catalog loaded; ranking and badges degrade without it */
  kev: "ok" | "unavailable";
  lastCheck: string;
}

let cached: { at: number; result: Promise<Health> } | null = null;

async function check(): Promise<Health> {
  const total = FEED_SOURCES.length;
  // Memoised for 6h and never throws, so this adds no load
  const kev = getKevIds().then((ids) => (ids.size > 0 ? "ok" : "unavailable") as Health["kev"]);
  try {
    const { failedFeeds } = await fetchAllFeeds();
    const feedsDown = failedFeeds.length;
    const feedsUp = total - feedsDown;
    const status = feedsDown === 0 ? "ok" : feedsUp === 0 ? "down" : "degraded";
    return { status, feedsUp, feedsDown, failedFeeds, kev: await kev, lastCheck: new Date().toISOString() };
  } catch {
    return {
      status: "down",
      feedsUp: 0,
      feedsDown: total,
      failedFeeds: FEED_SOURCES.map((f) => f.name),
      kev: await kev,
      lastCheck: new Date().toISOString(),
    };
  }
}

export async function GET() {
  const now = Date.now();
  // Concurrent requests share one in-flight check
  if (!cached || now - cached.at > TTL_MS) cached = { at: now, result: check() };
  const { at, result } = cached;
  const body = await result;
  const remaining = Math.max(0, Math.floor((TTL_MS - (Date.now() - at)) / 1000));
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": remaining > 0 ? `public, s-maxage=${remaining}` : "no-store",
    },
  });
}
