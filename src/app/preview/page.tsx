import type { Metadata } from "next";
import { Readex_Pro } from "next/font/google";
import WejiPreview from "@/components/weji/WejiPreview";
import { trendingAnime } from "@/lib/search/anime";
import { curatedPexels, demoImages, hasKeys, interleave, popularUnsplash } from "@/lib/search/providers";
import "./weji.css";

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WEJI ويجي — Design preview",
  // A work-in-progress page: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

/** The first screen of pictures: popular photos, curated photos and this season's anime. */
export default async function PreviewPage() {
  let images = demoImages("weji-lattice", 1, 160);
  if (hasKeys()) {
    const [unsplash, pexelsA, pexelsB, anime] = await Promise.all([
      popularUnsplash(1, 30),
      curatedPexels(1, 80),
      curatedPexels(2, 80),
      trendingAnime(24),
    ]);
    const live = interleave(interleave(unsplash, pexelsA, anime), pexelsB);
    // If the providers were down, still fill the room with something.
    if (live.length >= 40) images = live;
  }

  return (
    <div className={readex.variable}>
      <WejiPreview initialImages={images} />
    </div>
  );
}
