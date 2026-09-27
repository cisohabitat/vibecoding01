import { NextResponse } from "next/server";
import { getArticles } from "@/lib/pipeline";

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
