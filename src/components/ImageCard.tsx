"use client";

import { useEffect, useRef, useState } from "react";
import { useLibrary } from "@/lib/library/LibraryProvider";
import type { WejiImage } from "@/lib/search/types";

/**
 * One picture in the grid.
 *
 * The hover lift is pure CSS. With several hundred cards on screen, anything
 * driven by JavaScript per-card would make scrolling stutter.
 */
export default function ImageCard({ image, onSelect }: { image: WejiImage; onSelect: (image: WejiImage) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { isLiked, toggleLike } = useLibrary();

  // Server-rendered images are often already decoded by the time React hydrates
  // and attaches onLoad, so that event never fires and the picture would stay
  // invisible. Catch that case on mount.
  useEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) setLoaded(true);
    else setFailed(true);
  }, []);

  // News CDNs go down, expire links, and hotlink-block. Dropping the card is
  // better than leaving a broken-image icon in the middle of the grid.
  if (failed) return null;

  const ratio = image.width && image.height ? image.width / image.height : 3 / 4;
  const isNews = image.source === "news";
  const liked = isLiked(image.id);

  // The card is a wrapper rather than one big button: the heart is a second,
  // separate control, and a button nested inside a button is invalid HTML that
  // screen readers and keyboard users handle badly.
  return (
    <div
      className="group relative w-full overflow-hidden rounded-xl border border-line bg-panel transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_18px_50px_-18px_#000,0_0_30px_-10px_#ffc24b55]"
      style={{ aspectRatio: String(ratio) }}
    >
      <button
        type="button"
        onClick={() => onSelect(image)}
        className="block h-full w-full text-start"
        aria-label={image.alt || "Open picture"}
      >
      {!loaded && <div className="shimmer absolute inset-0" />}

      <img
        ref={imgRef}
        src={image.thumb}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.06] ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={{ backgroundColor: image.color }}
      />

      {/* Caption sheet, revealed on hover / always visible for news. */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 p-3 transition-opacity duration-300 ${
          isNews ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{
          // News cards carry a headline over the picture, so they need a much
          // heavier scrim — a bright sky behind white text is unreadable.
          backgroundImage: isNews
            ? "linear-gradient(to top, #000000f5 0%, #000000d9 30%, #0000008c 58%, transparent 88%)"
            : "linear-gradient(to top, #000000e6, #00000073 45%, transparent)",
        }}
      >
        {isNews ? (
          <>
            <span className="mb-1 inline-block rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
              {image.outlet}
            </span>
            <p className="line-clamp-3 text-xs leading-snug text-white">{image.alt}</p>
          </>
        ) : (
          <p className="truncate text-xs text-white/85">{image.credit}</p>
        )}
      </div>
      </button>

      <button
        type="button"
        onClick={() => void toggleLike(image)}
        aria-label={image.alt ? `Like: ${image.alt}` : "Like"}
        aria-pressed={liked}
        className={`absolute end-2 top-2 h-9 w-9 place-items-center rounded-full border backdrop-blur transition ${
          liked
            ? "grid border-gold/60 bg-ink/85 text-gold"
            : "hidden border-line-strong bg-ink/70 text-white/80 hover:border-gold/60 hover:text-gold group-hover:grid"
        }`}
      >
        {liked ? "♥" : "♡"}
      </button>
    </div>
  );
}
