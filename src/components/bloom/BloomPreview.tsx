"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Attribution from "@/components/Attribution";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CATEGORIES } from "@/lib/search/translate";
import type { WejiImage } from "@/lib/search/types";
import type { BloomCanvasControls } from "./BloomCanvas";
import type { BloomPicture } from "./scene";
import { detectTier, type DeviceTier } from "./tier";

// three.js is only fetched once the page has painted, and never on the server.
const BloomCanvas = dynamic(() => import("./BloomCanvas"), { ssr: false });

const toPicture = (image: WejiImage): BloomPicture => ({
  id: image.id,
  thumb: image.thumb,
  color: image.color,
  width: image.width,
  height: image.height,
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const LETTERS = ["W", "E", "J", "I"];
const TOPICS = CATEGORIES.slice(0, 8);
const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

export default function BloomPreview({ initialImages }: { initialImages: WejiImage[] }) {
  const { t, locale, toggleLocale } = useLocale();

  const [tier, setTier] = useState<DeviceTier | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [images, setImages] = useState(initialImages);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [portalShown, setPortalShown] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const controls = useRef<BloomCanvasControls | null>(null);
  const initialPictures = useRef(initialImages.map(toPicture));

  // Decided in the browser: the server can't know what this device can draw.
  useEffect(() => {
    setTier(detectTier());
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const openImage = openIndex === null ? null : (images[openIndex] ?? null);

  const handleOpen = useCallback((index: number) => {
    setOpenIndex(index);
    setPortalShown(true);
  }, []);

  const handleClosed = useCallback(() => setOpenIndex(null), []);

  const closePortal = useCallback(() => {
    setPortalShown(false);
    if (tier === "none" || !controls.current) {
      setOpenIndex(null);
      return;
    }
    // The picture flies back first; handleClosed clears it when it lands.
    controls.current.closePortal();
  }, [tier]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePortal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, closePortal]);

  /** Search, then fold the current pictures away and bloom the results. */
  const bloomWith = useCallback(
    async (text: string, topic: string | null) => {
      const trimmed = text.trim();
      if (!trimmed || busy || openIndex !== null) return;
      setBusy(true);
      setActiveTopic(topic);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const data = (await response.json()) as { images?: WejiImage[] };
        const next = (data.images ?? []).filter((image) => image.source !== "news");
        if (next.length > 0) {
          setImages(next);
          controls.current?.rebloom(next.map(toPicture));
        }
      } catch {
        // Keep the current bloom if the search fails.
      } finally {
        setBusy(false);
      }
    },
    [busy, openIndex],
  );

  const has3d = tier === "high" || tier === "low";

  return (
    <div className="bloom fixed inset-0 overflow-hidden">
      {has3d && (
        <BloomCanvas
          pictures={initialPictures.current}
          tier={tier}
          reducedMotion={reducedMotion}
          controls={controls}
          onOpen={handleOpen}
          onClosed={handleClosed}
        />
      )}
      {tier === "none" && <FlatGrid images={images} onOpen={handleOpen} />}

      {/* The overlay ignores the pointer except on its controls, so dragging
          anywhere else reaches the 3D scene underneath. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <header
          className="flex items-center justify-between gap-3 px-5 pb-10 pt-5 sm:px-8"
          style={{ background: "linear-gradient(to bottom, rgba(7,6,13,0.85), rgba(7,6,13,0))" }}
        >
          <Link
            href="/"
            className="bloom-focus pointer-events-auto flex items-baseline gap-2 rounded-md text-sm font-semibold tracking-wide"
          >
            WEJI
            {/* Solid colour at this size: a gradient blurs the Arabic dots
                until ويجي reads as a different word. */}
            <span className="font-[family-name:var(--font-kufi)] text-lg font-bold leading-none text-[#ffb23f]">
              ويجي
            </span>
          </Link>

          <span className="hidden rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70 sm:inline">
            {t.previewBadge}
          </span>

          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleLocale}
              className="bloom-chip bloom-focus rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {t.langLabel}
            </button>
            <Link href="/home" className="bloom-chip bloom-focus rounded-full px-3 py-1.5 text-xs font-semibold">
              {t.bloomBackToLive}
            </Link>
          </div>
        </header>

        <main className="relative flex flex-1 flex-col items-center justify-center px-5 text-center">
          <div
            aria-hidden
            className="bloom-scrim absolute left-1/2 top-1/2 h-[min(30rem,85vw)] w-[min(46rem,115vw)] -translate-x-1/2 -translate-y-1/2"
          />

          <div className="relative flex flex-col items-center">
            <h1 className="bloom-wordmark" aria-label="WEJI ويجي">
              {LETTERS.map((letter, index) => (
                <span key={letter + index} aria-hidden className="bloom-letter" style={cssVars({ "--i": index })}>
                  {letter}
                </span>
              ))}
            </h1>
            <p className="bloom-arabic -mt-1" aria-hidden dir="rtl">
              ويجي
            </p>

            <p
              className="bloom-rise mt-3 max-w-md text-pretty text-sm text-[#d6cff0] sm:text-base"
              style={cssVars({ "--delay": "1.5s" })}
            >
              {t.bloomTagline}
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void bloomWith(query, null);
              }}
              role="search"
              className="bloom-rise bloom-search pointer-events-auto mt-7 flex w-[min(34rem,90vw)] items-center gap-2 rounded-full p-1.5 ps-5"
              style={cssVars({ "--delay": "1.7s" })}
            >
              <input
                id="bloom-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchAction}
                className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f88ab]"
              />
              <button
                type="submit"
                disabled={busy}
                className="bloom-button bloom-focus shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-70"
              >
                {busy ? t.bloomBusy : t.searchAction}
              </button>
            </form>

            <div
              className="bloom-rise pointer-events-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2"
              style={cssVars({ "--delay": "1.9s" })}
            >
              {TOPICS.map((topic) => (
                <button
                  key={topic.query}
                  type="button"
                  aria-pressed={activeTopic === topic.query}
                  onClick={() => void bloomWith(topic.query, topic.query)}
                  className="bloom-chip bloom-focus rounded-full px-3.5 py-1.5 text-xs sm:text-sm"
                >
                  {locale === "ar" ? topic.ar : topic.en}
                </button>
              ))}
            </div>
          </div>
        </main>

        <footer
          className="bloom-rise flex flex-col items-center gap-1 px-5 pb-5 pt-12 text-center"
          style={cssVars({
            "--delay": "2.2s",
            background: "linear-gradient(to top, rgba(7,6,13,0.92), rgba(7,6,13,0))",
          })}
        >
          <p className="text-[11px] tracking-wide text-[#a79fc4]">{t.bloomHint}</p>
          <div className="pointer-events-auto">
            <Attribution className="!text-[#8f88ab]" />
          </div>
        </footer>
      </div>

      {openImage && (
        <Portal image={openImage} shown={portalShown} waitForFlight={has3d} onClose={closePortal} />
      )}
    </div>
  );
}

/**
 * The opened picture, full size, over its own colour. In 3D it fades in only
 * as the flying tile arrives, so the two read as one continuous motion.
 */
function Portal({
  image,
  shown,
  waitForFlight,
  onClose,
}: {
  image: WejiImage;
  shown: boolean;
  waitForFlight: boolean;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const glow = HEX_COLOR.test(image.color) ? image.color : "#8b6cff";
  const stop = (event: React.MouseEvent) => event.stopPropagation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Picture"}
      onClick={onClose}
      className={`fixed inset-0 z-30 flex flex-col items-center justify-center gap-5 p-5 transition-opacity duration-500 ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      style={{
        transitionDelay: shown && waitForFlight ? "560ms" : "0ms",
        background: `radial-gradient(circle at 50% 42%, ${glow}66, rgba(7, 6, 13, 0.94) 68%)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.full}
        alt={image.alt}
        onClick={stop}
        className="max-h-[68vh] max-w-[90vw] rounded-2xl object-contain shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        style={{ backgroundColor: image.color }}
      />

      <div
        onClick={stop}
        className="bloom-search flex max-w-[min(40rem,92vw)] flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl px-5 py-3 text-center text-xs sm:text-sm"
      >
        {image.alt && <p className="w-full text-[#ece7ff]">{image.alt}</p>}
        <p className="text-[#a79fc4]">
          {t.viewerBy}{" "}
          <a href={image.creditUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-white">
            {image.credit}
          </a>{" "}
          {t.viewerOn}{" "}
          <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-white">
            {image.sourceName}
          </a>
        </p>
        <button type="button" onClick={onClose} className="bloom-button bloom-focus rounded-full px-4 py-1.5 text-xs font-semibold">
          {t.viewerClose}
        </button>
      </div>
    </div>
  );
}

/** For devices with no WebGL at all: the same pictures, flat, still openable. */
function FlatGrid({ images, onOpen }: { images: WejiImage[]; onOpen: (index: number) => void }) {
  return (
    <div className="absolute inset-0 grid auto-rows-[9rem] grid-cols-3 gap-2 overflow-hidden p-2 opacity-50 sm:grid-cols-6">
      {images.slice(0, 24).map((image, index) => (
        <button
          key={image.id}
          type="button"
          onClick={() => onOpen(index)}
          className="overflow-hidden rounded-xl"
          style={{ backgroundColor: image.color }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.thumb} alt={image.alt} loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
