import type { Metadata } from "next";
import { Readex_Pro, Reem_Kufi } from "next/font/google";
import BloomPreview from "@/components/bloom/BloomPreview";
import { curatedPexels, demoImages, hasKeys, interleave, popularUnsplash } from "@/lib/search/providers";
import "./bloom.css";

// Readex Pro's HEXP axis is what lets the WEJI wordmark physically widen.
const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  axes: ["HEXP"],
  variable: "--font-readex",
  display: "swap",
});

const kufi = Reem_Kufi({
  subsets: ["arabic", "latin"],
  variable: "--font-kufi",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WEJI ويجي — Design preview",
  // A work-in-progress page: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const revalidate = 3600;

export default async function PreviewPage() {
  const images = hasKeys()
    ? interleave(await popularUnsplash(1, 30), await curatedPexels(1, 30)).slice(0, 48)
    : demoImages("weji-bloom", 1, 48);

  // If both providers were down, still bloom with something.
  const pictures = images.length >= 16 ? images : demoImages("weji-bloom", 1, 48);

  return (
    <div className={`${readex.variable} ${kufi.variable}`}>
      <BloomPreview initialImages={pictures} />
    </div>
  );
}
