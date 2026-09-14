"use client";

import ImageCard from "./ImageCard";
import type { WejiImage } from "@/lib/search/types";

export default function MasonryGrid({
  images,
  onSelect,
}: {
  images: WejiImage[];
  onSelect: (image: WejiImage) => void;
}) {
  return (
    <div className="masonry">
      {images.map((image) => (
        <ImageCard key={image.id} image={image} onSelect={onSelect} />
      ))}
    </div>
  );
}

/** Placeholder tiles with varied heights, so loading looks like the real grid. */
export function MasonrySkeleton({ count = 12 }: { count?: number }) {
  const heights = [220, 300, 260, 340, 240, 290];
  return (
    <div className="masonry" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="shimmer rounded-xl" style={{ height: heights[i % heights.length] }} />
      ))}
    </div>
  );
}
