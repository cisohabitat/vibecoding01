import { NextResponse } from "next/server";
import { getArticles } from "@/lib/pipeline";

// A cold data cache runs the whole pipeline: worst case ~25s (10s feed
// timeout + retry, then NVD). Don't rely on the platform's default limit.
export const maxDuration = 60;

export const revalidate = 900;

export async function GET() {
  const { featured, recent, lastUpdated, failedFeeds } = await getArticles();
  return NextResponse.json(
    {
      lastUpdated,
      count: featured.length + recent.length,
      failedFeeds,
      featured,
      recent,
    },
    {
      headers: {
        // Public, read-only data: allow other sites' scripts to read it
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
      },
    }
  );
}
