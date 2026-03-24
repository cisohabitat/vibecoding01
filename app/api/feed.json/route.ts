import { NextResponse } from "next/server";
import { getArticles } from "@/lib/pipeline";

export const revalidate = 900;

export async function GET() {
  const { featured, recent, lastUpdated } = await getArticles();
  return NextResponse.json({
    lastUpdated,
    count: featured.length + recent.length,
    featured,
    recent,
  });
}
