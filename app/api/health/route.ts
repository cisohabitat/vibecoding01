import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";

// Rendered per request (ISR's stale-while-revalidate would hand a monitor
// the *previous* check's result). Checking fetches every feed, so results
// are memoised for 60s per instance and the CDN may cache them for 60s,
// never serving stale.
export const dynamic = "force-dynamic";

const TTL_MS = 60_000;

interface Health {
  status: "ok" | "degraded" | "down";
  feedsUp: number;
  feedsDown: number;
  lastCheck: string;
}

let cached: { at: number; result: Promise<Health> } | null = null;

async function check(): Promise<Health> {
  const total = FEED_SOURCES.length;
  try {
    const { failedFeeds } = await fetchAllFeeds();
    const feedsDown = failedFeeds.length;
    const feedsUp = total - feedsDown;
    const status = feedsDown === 0 ? "ok" : feedsUp === 0 ? "down" : "degraded";
    return { status, feedsUp, feedsDown, lastCheck: new Date().toISOString() };
  } catch {
    return { status: "down", feedsUp: 0, feedsDown: total, lastCheck: new Date().toISOString() };
  }
}

export async function GET() {
  const now = Date.now();
  // Concurrent requests share one in-flight check
  if (!cached || now - cached.at > TTL_MS) cached = { at: now, result: check() };
  return NextResponse.json(await cached.result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=0" },
  });
}
