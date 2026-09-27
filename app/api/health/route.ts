import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";

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
  const { at, result } = cached;
  const body = await result;
  const remaining = Math.max(0, Math.floor((TTL_MS - (Date.now() - at)) / 1000));
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": remaining > 0 ? `public, s-maxage=${remaining}` : "no-store",
    },
  });
}
