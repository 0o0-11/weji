import { NextResponse } from "next/server";
import { curatedPexels, demoImages, hasKeys, interleave, popularUnsplash } from "@/lib/search/providers";
import type { SearchResponse } from "@/lib/search/types";

const PER_PAGE = 24;

/** The trending-wallpaper feed on the home page and the pictures in the 3D hero. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.min(Math.max(Number(searchParams.get("page") ?? 1) || 1, 1), 40);
  const perPage = Math.min(Math.max(Number(searchParams.get("perPage") ?? PER_PAGE) || PER_PAGE, 1), 40);

  const demo = !hasKeys();
  const images = demo
    ? demoImages("trending", page, perPage)
    : interleave(await popularUnsplash(page, perPage), await curatedPexels(page, perPage));

  const body: SearchResponse = {
    images,
    query: "trending",
    originalQuery: "trending",
    translated: false,
    page,
    demo,
  };

  return NextResponse.json(body);
}
