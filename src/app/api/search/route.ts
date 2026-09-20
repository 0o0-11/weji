import { NextResponse } from "next/server";
import { isArabic, translateQuery } from "@/lib/search/translate";
import { isQueryBlocked } from "@/lib/search/safety";
import { demoImages, hasKeys, interleave, searchPexels, searchUnsplash } from "@/lib/search/providers";
import { searchAnime } from "@/lib/search/anime";
import { searchOpenverse } from "@/lib/search/openverse";
import type { SearchResponse, WejiImage } from "@/lib/search/types";

const PER_PAGE = 24;

/**
 * `size=wide` is the 3D lattice asking for a whole room of pictures in one go.
 * Volume comes from Pexels (80 a page), because Unsplash's current tier allows
 * only 50 requests an hour and Openverse only 20 pictures a request.
 */
const WIDE = { unsplash: 30, pexels: 80, pexelsPages: 2 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const page = Math.min(Math.max(Number(searchParams.get("page") ?? 1) || 1, 1), 40);
  const wide = searchParams.get("size") === "wide";

  if (!rawQuery) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  // Layer 1 of the safety filter: refuse the search outright.
  if (isQueryBlocked(rawQuery)) {
    return NextResponse.json({ blocked: true }, { status: 200 });
  }

  // Arabic in, English out — otherwise the providers return nothing.
  // `raw=1` is the escape hatch behind "search the exact words instead", for
  // when our translation guessed wrong.
  const skipTranslation = searchParams.get("raw") === "1";
  const translation = skipTranslation
    ? { query: rawQuery, original: rawQuery, translated: false, method: "none" as const }
    : await translateQuery(rawQuery);

  // The translation can itself land on a blocked term.
  if (isQueryBlocked(translation.query)) {
    return NextResponse.json({ blocked: true }, { status: 200 });
  }

  const demo = !hasKeys();
  const query = translation.query;
  let images: WejiImage[];

  if (demo) {
    images = demoImages(query, page, wide ? 160 : PER_PAGE);
  } else {
    // Names are searched as typed when they're already in Latin letters:
    // translation can mangle "Jong Gun" but never improves it.
    const animeQuery = isArabic(rawQuery) ? query : rawQuery;
    const pexelsPages = wide ? WIDE.pexelsPages : 1;

    const [anime, unsplash, openverse, ...pexels] = await Promise.all([
      page === 1 ? searchAnime(animeQuery) : Promise.resolve([]),
      searchUnsplash(query, page, wide ? WIDE.unsplash : PER_PAGE),
      searchOpenverse(query, page),
      ...Array.from({ length: pexelsPages }, (_, i) =>
        searchPexels(query, (page - 1) * pexelsPages + 1 + i, wide ? WIDE.pexels : PER_PAGE),
      ),
    ]);

    // Anime matches are exact name or title matches, so they lead: someone
    // searching a character wants the character, not stock photos of parks.
    // interleave() also drops any picture that appears twice.
    images = interleave([...anime, ...interleave(unsplash, pexels.flat(), openverse)]);
  }

  const body: SearchResponse = {
    images,
    query: translation.query,
    originalQuery: translation.original,
    translated: translation.translated,
    page,
    demo,
  };

  return NextResponse.json(body);
}
