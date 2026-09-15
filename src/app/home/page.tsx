import HomeFeed from "@/components/HomeFeed";
import { getNewsImages } from "@/lib/news/rss";
import { curatedPexels, demoImages, hasKeys, interleave, popularUnsplash } from "@/lib/search/providers";

// News moves; popular photographs don't. Fifteen minutes keeps the page current
// without re-reading the publishers' feeds on every visit.
export const revalidate = 900;

export default async function HomePage() {
  const demo = !hasKeys();

  // Both languages are fetched so the client can show the reader's own without
  // a second round trip.
  const [news, trending] = await Promise.all([
    getNewsImages(undefined, 48),
    demo
      ? Promise.resolve(demoImages("trending", 1, 24))
      : Promise.all([popularUnsplash(1, 12), curatedPexels(1, 12)]).then(([a, b]) => interleave(a, b)),
  ]);

  return (
    <HomeFeed
      news={news}
      trending={trending.length > 0 ? trending : demoImages("trending", 1, 24)}
      demo={demo}
    />
  );
}
