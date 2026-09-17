"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Lenis from "lenis";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import DownloadMenu from "@/components/DownloadMenu";
import SaveMenu from "@/components/SaveMenu";
import { isDownloadable } from "@/lib/download";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
import { CATEGORIES } from "@/lib/search/translate";
import type { SearchResponse, WejiImage } from "@/lib/search/types";
import type { LatticeControls } from "./LatticeCanvas";
import type { LatticePicture, ScrollDriver } from "./scene";
import { detectTier, type DeviceTier } from "./tier";

// three.js is only fetched once the page has painted, and never on the server.
const LatticeCanvas = dynamic(() => import("./LatticeCanvas"), { ssr: false });

const toPicture = (image: WejiImage): LatticePicture => ({
  id: image.id,
  thumb: image.thumb,
  full: image.full,
  color: image.color,
  width: image.width,
  height: image.height,
});

const SOURCE_LABELS: Record<WejiImage["source"], string> = {
  anime: "AniList",
  unsplash: "Unsplash",
  pexels: "Pexels",
  openverse: "Openverse",
  demo: "Picsum",
  news: "News",
};

/** Cycled through the empty search box, one language after the other. */
const EXAMPLES = [
  "Park Jong Gun",
  "غروب الشمس",
  "Lookism",
  "صحراء",
  "Tokyo at night",
  "قطط",
  "Naruto",
  "شلالات",
  "Northern lights",
];

const TOPICS = [
  ...["landscape", "desert", "architecture", "space", "cars", "animals", "abstract art"].map(
    (query) => CATEGORIES.find((category) => category.query === query)!,
  ),
  { en: "Anime: Naruto", ar: "أنمي: ناروتو", query: "Naruto" },
];

/** How far to scroll for one full turn of the room. */
const SCROLL_PER_TURN = 8000;

type Status =
  | { kind: "results"; count: number; sources: string[]; translated: { from: string; to: string } | null }
  | { kind: "empty" }
  | { kind: "blocked" };

const cssVars = (vars: Record<string, string | number>) => vars as CSSProperties;

function sourcesOf(images: WejiImage[]) {
  return [...new Set(images.map((image) => SOURCE_LABELS[image.source]))];
}

function useTypewriter(enabled: boolean) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let example = 0;
    let length = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = EXAMPLES[example % EXAMPLES.length];
      if (!deleting) {
        length += 1;
        setText(word.slice(0, length));
        if (length >= word.length) {
          deleting = true;
          timer = setTimeout(tick, 1800);
          return;
        }
        timer = setTimeout(tick, 70);
      } else {
        length -= 1;
        setText(word.slice(0, length));
        if (length <= 0) {
          deleting = false;
          example += 1;
          timer = setTimeout(tick, 380);
          return;
        }
        timer = setTimeout(tick, 30);
      }
    };
    timer = setTimeout(tick, 2400);
    return () => clearTimeout(timer);
  }, [enabled]);
  return text;
}

export default function LatticePreview({ initialImages }: { initialImages: WejiImage[] }) {
  const { t, locale, dir, toggleLocale } = useLocale();

  const [tier, setTier] = useState<DeviceTier | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scroll, setScroll] = useState<ScrollDriver | null>(null);
  const [images, setImages] = useState(initialImages);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [infoShown, setInfoShown] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [docked, setDocked] = useState(false);
  const [status, setStatus] = useState<Status>({
    kind: "results",
    count: initialImages.length,
    sources: sourcesOf(initialImages),
    translated: null,
  });

  const controls = useRef<LatticeControls | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Decided in the browser: the server can't know what this device can draw.
  useEffect(() => {
    setTier(detectTier());
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const has3d = tier === "high" || tier === "low";

  // Smooth, weighted scrolling (Lenis) turns the room; the scene drives its clock.
  useEffect(() => {
    if (!has3d) return;
    const lenis = new Lenis({
      infinite: true,
      syncTouch: true,
      gestureOrientation: "both",
      lerp: 0.085,
      touchMultiplier: 1.6,
      respectReducedMotion: true,
    });
    setScroll({
      raf: (time) => lenis.raf(time),
      turns: () => (lenis.limit > 0 ? lenis.animatedScroll / lenis.limit : 0),
      stop: () => lenis.stop(),
      start: () => lenis.start(),
    });
    return () => {
      lenis.destroy();
      setScroll(null);
    };
  }, [has3d]);

  const typed = useTypewriter(!reducedMotion && !query);

  const openImage = openIndex === null ? null : (images[openIndex] ?? null);

  const handleOpen = useCallback((index: number) => {
    setOpenIndex(index);
    setInfoShown(true);
  }, []);
  const handleClosing = useCallback(() => setInfoShown(false), []);
  const handleClosed = useCallback(() => setOpenIndex(null), []);
  const handleFirstTurn = useCallback(() => setDocked(true), []);

  const close = useCallback(() => {
    setInfoShown(false);
    if (!has3d || !controls.current) {
      setOpenIndex(null);
      return;
    }
    controls.current.close();
  }, [has3d]);

  useEffect(() => {
    if (openIndex === null) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, close]);

  const runSearch = useCallback(
    async (text: string, topic: string | null) => {
      const trimmed = text.trim();
      if (!trimmed || busy || openIndex !== null) return;
      setBusy(true);
      setActiveTopic(topic);
      setDocked(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&size=wide`);
        const data = (await response.json()) as Partial<SearchResponse> & { blocked?: boolean };
        if (data.blocked) {
          setStatus({ kind: "blocked" });
          return;
        }
        const next = (data.images ?? []).filter((image) => image.source !== "news");
        if (next.length === 0) {
          setStatus({ kind: "empty" });
          return;
        }
        setImages(next);
        controls.current?.showResults(next.map(toPicture));
        setStatus({
          kind: "results",
          count: next.length,
          sources: sourcesOf(next),
          translated: data.translated && data.query ? { from: data.originalQuery ?? trimmed, to: data.query } : null,
        });
      } catch {
        setStatus({ kind: "empty" });
      } finally {
        setBusy(false);
      }
    },
    [busy, openIndex],
  );

  const statusText = useMemo(() => {
    if (status.kind === "blocked") return t.latticeBlocked;
    if (status.kind === "empty") return t.latticeNothing;
    return `${status.count} ${t.latticePictures} · ${status.sources.join(" · ")}`;
  }, [status, t]);

  return (
    <div className="lt">
      <div className="fixed inset-0">
        {has3d && scroll && (
          <LatticeCanvas
            pictures={images.map(toPicture)}
            tier={tier}
            reducedMotion={reducedMotion}
            direction={dir === "rtl" ? -1 : 1}
            scroll={scroll}
            controls={controls}
            onOpen={handleOpen}
            onClosing={handleClosing}
            onClosed={handleClosed}
            onFirstTurn={handleFirstTurn}
          />
        )}
        {tier === "none" && <FlatGrid images={images} onOpen={handleOpen} />}
      </div>

      {/* Scrolling this invisible column is what turns the room. */}
      {has3d && <div aria-hidden style={{ height: `calc(100svh + ${SCROLL_PER_TURN}px)` }} />}

      {/* The overlay ignores the pointer except on its controls, so everything
          else reaches the room underneath. */}
      <div className={`lt-overlay ${openImage ? "is-open" : ""}`}>
        <header className="lt-header lt-enter" style={cssVars({ "--delay": "0.15s" })}>
          <Link href="/" className="lt-focus lt-live flex items-baseline gap-2 rounded-md text-sm font-semibold tracking-wide">
            WEJI
            <span className="text-base font-bold leading-none text-[#ffb23f]">ويجي</span>
          </Link>
          <span className="hidden rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/70 sm:inline">
            {t.previewBadge}
          </span>
          <div className="lt-live flex items-center gap-2">
            <button type="button" onClick={toggleLocale} className="lt-chip lt-focus rounded-full px-3 py-1.5 text-xs font-semibold">
              {t.langLabel}
            </button>
            <Link href="/home" className="lt-chip lt-focus rounded-full px-3 py-1.5 text-xs font-semibold">
              {t.latticeBackToLive}
            </Link>
          </div>
        </header>

        <div className={`lt-title ${docked ? "is-docked" : ""}`} aria-hidden={docked}>
          <div aria-hidden className="lt-title-scrim" />
          <h1 className="lt-wordmark" aria-label="WEJI ويجي">
            <span className="lt-wipe" style={cssVars({ "--delay": "1.0s" })}>
              <span className="lt-wipe-inner lt-latin">WEJI</span>
            </span>
            <span className="lt-wipe" style={cssVars({ "--delay": "1.2s" })}>
              <span className="lt-wipe-inner lt-arabic" dir="rtl">
                ويجي
              </span>
            </span>
          </h1>
          <p className="lt-enter lt-tagline" style={cssVars({ "--delay": "1.45s" })}>
            {t.latticeTagline}
          </p>
        </div>

        <div className={`lt-searchwrap ${docked ? "is-docked" : ""}`}>
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              inputRef.current?.blur();
              void runSearch(query, null);
            }}
            className="lt-land lt-search lt-live flex items-center gap-2 rounded-full p-1.5 ps-5"
            style={cssVars({ "--delay": "1.7s" })}
          >
            <div className="relative min-w-0 flex-1">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={reducedMotion ? t.searchPlaceholder : ""}
                aria-label={t.searchAction}
                enterKeyHint="search"
                className="w-full bg-transparent py-2 text-base text-white outline-none placeholder:text-[#8f88ab]"
              />
              {!query && !reducedMotion && (
                <span aria-hidden className={`lt-typed ${focused ? "is-dim" : ""}`}>
                  <span className="lt-typed-label">{t.latticeTry}</span>{" "}
                  <bdi>{typed}</bdi>
                  <span className="lt-caret" />
                </span>
              )}
            </div>
            <button type="submit" disabled={busy} className="lt-bank lt-focus shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold">
              <span>{busy ? t.latticeBusy : t.searchAction}</span>
            </button>
          </form>

          <div className="lt-pills lt-live" style={cssVars({ "--delay": "1.9s" })}>
            {TOPICS.map((topic, index) => (
              <button
                key={topic.query}
                type="button"
                aria-pressed={activeTopic === topic.query}
                onClick={() => {
                  setQuery("");
                  void runSearch(topic.query, topic.query);
                }}
                className="lt-pill lt-focus"
                style={cssVars({ "--i": index })}
              >
                <span className="lt-pill-dot" aria-hidden />
                {locale === "ar" ? topic.ar : topic.en}
              </button>
            ))}
          </div>

          <div className="lt-status" aria-live="polite">
            {docked && (
              <p key={statusText} className="lt-status-pill">
                {status.kind === "results" && status.translated && (
                  <>
                    {t.searchedFor} <bdi className="text-white">“{status.translated.to}”</bdi>
                    <span className="opacity-60"> · </span>
                  </>
                )}
                {statusText}
              </p>
            )}
          </div>
        </div>

        <footer className="lt-footer lt-enter" style={cssVars({ "--delay": "2.3s" })}>
          <p className="text-[11px] tracking-wide text-[#b3abd1]">{t.latticeHint}</p>
          <p className="lt-live text-[11px] text-[#8f88ab]">
            {t.latticePicturesFrom}{" "}
            <a href="https://unsplash.com/?utm_source=WEJI&utm_medium=referral" target="_blank" rel="noopener noreferrer">
              Unsplash
            </a>
            {" · "}
            <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">
              Pexels
            </a>
            {" · "}
            <a href="https://openverse.org" target="_blank" rel="noopener noreferrer">
              Openverse
            </a>
            {" · "}
            <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">
              AniList
            </a>
          </p>
        </footer>
      </div>

      {openImage && (
        <OpenPanel
          image={openImage}
          shown={infoShown}
          flat={!has3d}
          closeRef={closeRef}
          onClose={close}
        />
      )}
    </div>
  );
}

/**
 * Everything about the opened picture. The picture itself is drawn by the 3D
 * scene, so this layer only holds the close button and the glass info bar,
 * which rises in once the star has finished unfolding.
 */
function OpenPanel({
  image,
  shown,
  flat,
  closeRef,
  onClose,
}: {
  image: WejiImage;
  shown: boolean;
  flat: boolean;
  closeRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const { isLiked, toggleLike } = useLibrary();
  const [copied, setCopied] = useState(false);
  const liked = isLiked(image.id);

  const share = async () => {
    const url = image.sourceUrl;
    try {
      if (navigator.share) {
        await navigator.share({ title: image.alt || "WEJI", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Cancelled by the visitor, or no clipboard access: nothing to do.
    }
  };

  const title = image.alt || image.credit;

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className={`lt-open ${shown ? "is-shown" : ""}`}>
      {flat && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.full} alt={image.alt} className="lt-flat-photo" onClick={onClose} />
      )}

      <button ref={closeRef} type="button" onClick={onClose} className="lt-close lt-focus" aria-label={t.viewerClose}>
        <span aria-hidden>×</span>
      </button>

      <div className="lt-info">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white sm:text-base">{title}</p>
          <p className="mt-0.5 truncate text-xs text-[#b3abd1]">
            {image.source === "anime" ? (
              <>
                {t.latticeSeries} <ExternalLink href={image.creditUrl}>{image.credit}</ExternalLink> {t.viewerOn}{" "}
                <ExternalLink href={image.sourceUrl}>{image.sourceName}</ExternalLink>
              </>
            ) : (
              <>
                {t.viewerBy} <ExternalLink href={image.creditUrl}>{image.credit}</ExternalLink> {t.viewerOn}{" "}
                <ExternalLink href={image.sourceUrl}>{image.sourceName}</ExternalLink>
                {image.license && (
                  <>
                    {" · "}
                    {image.licenseUrl ? <ExternalLink href={image.licenseUrl}>{image.license}</ExternalLink> : image.license}
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleLike(image)}
            aria-pressed={liked}
            className={`lt-chip lt-focus rounded-full px-3.5 py-2 text-sm ${liked ? "is-liked" : ""}`}
          >
            <span aria-hidden>{liked ? "♥" : "♡"}</span> {liked ? t.viewerLiked : t.viewerLike}
          </button>
          <SaveMenu image={image} />
          {isDownloadable(image) ? (
            <DownloadMenu image={image} />
          ) : (
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="lt-bank lt-focus rounded-full px-4 py-2 text-sm font-semibold">
              <span>{t.latticeNoDownload} ↗</span>
            </a>
          )}
          <button type="button" onClick={() => void share()} className="lt-chip lt-focus rounded-full px-3.5 py-2 text-sm">
            {copied ? t.latticeCopied : t.viewerShare}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-2 hover:text-white">
      {children}
    </a>
  );
}

/** For devices without WebGL 2: the same pictures, flat, still openable. */
function FlatGrid({ images, onOpen }: { images: WejiImage[]; onOpen: (index: number) => void }) {
  return (
    <div className="absolute inset-0 grid auto-rows-[9rem] grid-cols-3 gap-2 overflow-y-auto p-2 pt-40 opacity-60 sm:grid-cols-6">
      {images.slice(0, 60).map((image, index) => (
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
