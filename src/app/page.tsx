import Landing from "@/components/Landing";
import { curatedPexels, demoImages, hasKeys, interleave, popularUnsplash } from "@/lib/search/providers";

// The hero pictures are the first thing a visitor ever sees, so they are
// rendered on the server and revalidated hourly rather than fetched in the
// browser — the ring is populated in the very first paint.
export const revalidate = 3600;

export default async function LandingPage() {
  const demo = !hasKeys();
  const images = demo
    ? demoImages("weji-hero", 1, 16)
    : interleave(await popularUnsplash(1, 10), await curatedPexels(1, 10)).slice(0, 16);

  // If both providers were configured but both failed, still show a scene.
  const safeImages = images.length >= 8 ? images : demoImages("weji-hero", 1, 16);

  return <Landing images={safeImages} demo={demo} />;
}
