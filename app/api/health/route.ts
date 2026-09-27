import { NextResponse } from "next/server";
import { fetchAllFeeds } from "@/lib/fetcher";
import { FEED_SOURCES } from "@/lib/feeds";

// Checking health fetches every feed, so cache the result: at most one
// check per minute however often the endpoint is polled.
export const revalidate = 60;

export async function GET() {
  const total = FEED_SOURCES.length;
  try {
    const { failedFeeds } = await fetchAllFeeds();
    const feedsDown = failedFeeds.length;
    const feedsUp = total - feedsDown;
    const status =
      feedsDown === 0 ? "ok" : feedsUp === 0 ? "down" : "degraded";
    return NextResponse.json({
      status,
      feedsUp,
      feedsDown,
      lastCheck: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      status: "down",
      feedsUp: 0,
      feedsDown: total,
      lastCheck: new Date().toISOString(),
    });
  }
}
