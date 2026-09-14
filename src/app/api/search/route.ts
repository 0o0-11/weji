import { NextResponse } from "next/server";
import { translateQuery } from "@/lib/search/translate";
import { isQueryBlocked } from "@/lib/search/safety";
import { demoImages, hasKeys, interleave, searchPexels, searchUnsplash } from "@/lib/search/providers";
import type { SearchResponse } from "@/lib/search/types";

const PER_PAGE = 24;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const page = Math.min(Math.max(Number(searchParams.get("page") ?? 1) || 1, 1), 40);

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
  const images = demo
    ? demoImages(translation.query, page, PER_PAGE)
    : interleave(
        await searchUnsplash(translation.query, page, PER_PAGE),
        await searchPexels(translation.query, page, PER_PAGE),
      );

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
