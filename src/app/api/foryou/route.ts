import { NextResponse } from "next/server";
import { isQueryBlocked } from "@/lib/search/safety";
import { demoImages, hasKeys, interleave, searchPexels, searchUnsplash } from "@/lib/search/providers";
import { CATEGORIES } from "@/lib/search/translate";

/**
 * The personalised feed: pictures from the topics a user follows.
 *
 * Topics are sent as English search terms and checked against the known
 * category list rather than trusted — this endpoint fans out to the image
 * providers, so accepting arbitrary text would let anyone use WEJI's API quota
 * as a free proxy for their own searches.
 *
 * Kept to a handful of topics because each one costs its own provider request,
 * and Unsplash's demo tier allows only 50 an hour.
 */

const MAX_TOPICS = 5;
const PER_TOPIC = 8;

const ALLOWED = new Set(CATEGORIES.map((category) => category.query));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const topics = (searchParams.get("topics") ?? "")
    .split(",")
    .map((topic) => topic.trim().toLowerCase())
    .filter((topic) => topic && ALLOWED.has(topic) && !isQueryBlocked(topic))
    .slice(0, MAX_TOPICS);

  if (topics.length === 0) {
    return NextResponse.json({ images: [], topics: [] });
  }

  const demo = !hasKeys();

  const perTopic = await Promise.all(
    topics.map(async (topic) => {
      if (demo) return demoImages(topic, 1, PER_TOPIC);
      const [unsplash, pexels] = await Promise.all([
        searchUnsplash(topic, 1, PER_TOPIC),
        searchPexels(topic, 1, PER_TOPIC),
      ]);
      return interleave(unsplash, pexels).slice(0, PER_TOPIC);
    }),
  );

  // Interleaved across topics, so a five-topic feed reads as one mixed page
  // rather than five separate blocks.
  return NextResponse.json(
    { images: interleave(...perTopic), topics },
    { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } },
  );
}
