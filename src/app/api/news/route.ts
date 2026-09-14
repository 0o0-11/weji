import { NextResponse } from "next/server";
import { getNewsImages } from "@/lib/news/rss";

/**
 * News pictures for the home page. Cached for 15 minutes at the edge so a busy
 * home page doesn't hammer the publishers' feeds.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const langParam = searchParams.get("lang");
  const lang = langParam === "ar" || langParam === "en" ? langParam : undefined;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 40) || 40, 1), 60);

  const images = await getNewsImages(lang, limit);

  return NextResponse.json(
    { images },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } },
  );
}
