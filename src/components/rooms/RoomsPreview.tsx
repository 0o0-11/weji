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
import type { RoomControls } from "./RoomsCanvas";
import type { RoomPicture, ScrollDriver } from "./RoomScene";
import { ROOM_KINDS, type RoomKind } from "./kinds";
import { THEME } from "./theme";
import { detectTier, type DeviceTier } from "./tier";

// three.js is only fetched once the page has painted, and never on the server.
const RoomsCanvas = dynamic(() => import("./RoomsCanvas"), { ssr: false });

const toPicture = (image: WejiImage): RoomPicture => ({
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

const TOPIC_QUERIES = ["nature", "architecture", "space", "cars", "animals", "abstract art"];

/** How far to scroll to move through a whole look once. */
const SCROLL_PER_TURN = 9000;

type Status =
  | { kind: "results"; count: number; sources: string[]; translated: string | null }
  | { kind: "empty" }
  | { kind: "blocked" };

const sourcesOf = (images: WejiImage[]) => [...new Set(images.map((image) => SOURCE_LABELS[image.source]))];

export default function RoomsPreview({ initialImages }: { initialImages: WejiImage[] }) {
  const { t, locale, toggleLocale } = useLocale();

  const [tier, setTier] = useState<DeviceTier | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [scroll, setScroll] = useState<ScrollDriver | null>(null);
  const [kind, setKind] = useState<RoomKind>("carousel");
  const [images, setImages] = useState(initialImages);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [infoShown, setInfoShown] = useState(false);
  const [centreIndex, setCentreIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [docked, setDocked] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  const controls = useRef<RoomControls | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Decided in the browser: the server can't know what this device can draw.
  useEffect(() => {
    setTier(detectTier());
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const requested = new URLSearchParams(window.location.search).get("look");
    if (ROOM_KINDS.includes(requested as RoomKind)) setKind(requested as RoomKind);
  }, []);

  const has3d = tier === "high" || tier === "low";

  // Smooth, weighted scrolling (Lenis) moves you through the pictures.
  useEffect(() => {
    if (!has3d) return;
    const lenis = new Lenis({
      infinite: true,
      syncTouch: true,
      gestureOrientation: "both",
      lerp: 0.08,
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

  const chooseKind = (next: RoomKind) => {
    if (next === kind || openIndex !== null) return;
    setKind(next);
    setCentreIndex(null);
    const url = new URL(window.location.href);
    url.searchParams.set("look", next);
    window.history.replaceState(null, "", url);
  };

  const openImage = openIndex === null ? null : (images[openIndex] ?? null);
  const centreImage = kind === "carousel" && centreIndex !== null ? (images[centreIndex] ?? null) : null;

  const handleOpen = useCallback((index: number) => {
    setOpenIndex(index);
    setInfoShown(true);
  }, []);
  const handleClosing = useCallback(() => setInfoShown(false), []);
  const handleClosed = useCallback(() => setOpenIndex(null), []);
  const handleInteract = useCallback(() => setDocked(true), []);
  const handleCentre = useCallback((index: number) => setCentreIndex(index), []);

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

  const search = async (text: string, chosenTopic: string | null) => {
    const trimmed = text.trim();
    if (!trimmed || busy || openIndex !== null) return;
    setBusy(true);
    setTopic(chosenTopic);
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
      setCentreIndex(null);
      controls.current?.showResults(next.map(toPicture));
      setStatus({ kind: "results", count: next.length, sources: sourcesOf(next), translated: data.translated && data.query ? data.query : null });
    } catch {
      setStatus({ kind: "empty" });
    } finally {
      setBusy(false);
    }
  };

  const statusText = useMemo(() => {
    if (!status) return null;
    if (status.kind === "blocked") return t.roomsBlocked;
    if (status.kind === "empty") return t.roomsNothing;
    const translated = status.translated ? `${t.searchedFor} “${status.translated}” · ` : "";
    return `${translated}${status.count} ${t.roomsPictures} · ${status.sources.join(" · ")}`;
  }, [status, t]);

  const lookLabel: Record<RoomKind, string> = { carousel: t.lookCarousel, gallery: t.lookGallery, floating: t.lookFloating };
  const lookHint: Record<RoomKind, string> = { carousel: t.lookCarouselHint, gallery: t.lookGalleryHint, floating: t.lookFloatingHint };
  const topics = [
    { label: t.roomsAnime, query: "anime" },
    ...TOPIC_QUERIES.map((value) => {
      const category = CATEGORIES.find((candidate) => candidate.query === value)!;
      return { label: locale === "ar" ? category.ar : category.en, query: category.query };
    }),
  ];

  return (
    <div className="rm" style={{ "--rm-ink": THEME.ink, "--rm-accent": THEME.accent } as CSSProperties}>
      <div className="fixed inset-0">
        {has3d && scroll && (
          <RoomsCanvas
            key={kind}
            kind={kind}
            pictures={images.map(toPicture)}
            tier={tier}
            reducedMotion={reducedMotion}
            scroll={scroll}
            controls={controls}
            onOpen={handleOpen}
            onClosing={handleClosing}
            onClosed={handleClosed}
            onInteract={handleInteract}
            onCentre={handleCentre}
          />
        )}
        {tier === "none" && <FlatGrid images={images} onOpen={handleOpen} />}
      </div>

      {/* Scrolling this invisible column is what moves you through the pictures. */}
      {has3d && <div aria-hidden style={{ height: `calc(100svh + ${SCROLL_PER_TURN}px)` }} />}

      <div className={`rm-overlay ${openImage ? "is-open" : ""} ${docked ? "is-docked" : ""}`}>
        <header className="rm-header">
          <Link href="/" className="rm-brand rm-focus">
            <span className="rm-brand-latin">WEJI</span>
            <span className="rm-brand-arabic">ويجي</span>
          </Link>
          <div className="rm-header-actions">
            <button type="button" onClick={toggleLocale} className="rm-link rm-focus">
              {t.langLabel}
            </button>
            <Link href="/account" className="rm-avatar rm-focus" aria-label={t.roomsAccount} title={t.roomsAccount}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
              </svg>
            </Link>
          </div>
        </header>

        {/* On arrival the search sits large in the middle; once you move or search, it shrinks to the top. */}
        <div className="rm-hero">
          <div aria-hidden className="rm-hero-scrim" />
          <h1 className="rm-headline">{t.roomsHeadline}</h1>
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              void search(query, null);
            }}
            className="rm-search"
          >
            <svg className="rm-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Enter searches even where the browser doesn't submit the form by itself;
                // not while an Arabic or other keyboard is still composing a word.
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void search(query, null);
                }
              }}
              placeholder={t.roomsSearchPlaceholder}
              aria-label={t.searchAction}
              enterKeyHint="search"
            />
            <button type="submit" disabled={busy} className="rm-go rm-focus" aria-label={t.searchAction}>
              {busy ? (
                <span className="rm-spinner" aria-hidden />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              )}
            </button>
          </form>
          <div className="rm-topics">
            {topics.map((entry) => (
              <button
                key={entry.query}
                type="button"
                aria-pressed={topic === entry.query}
                onClick={() => {
                  setQuery(entry.label);
                  void search(entry.query, entry.query);
                }}
                className="rm-topic rm-focus"
              >
                {entry.label}
              </button>
            ))}
          </div>
          <p className="rm-status" aria-live="polite">
            {statusText}
          </p>
        </div>

        <footer className="rm-footer">
          {centreImage && (
            <div className="rm-caption" key={centreImage.id}>
              <p className="rm-caption-title">{centreImage.alt || centreImage.credit}</p>
              <p className="rm-caption-credit">
                {centreImage.credit} · {centreImage.sourceName}
              </p>
            </div>
          )}
          <div className="rm-looks" role="tablist" aria-label={t.roomsTry}>
            <span className="rm-looks-label">{t.roomsTry}</span>
            {ROOM_KINDS.map((option, index) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={kind === option}
                onClick={() => chooseKind(option)}
                className="rm-look rm-focus"
              >
                <span aria-hidden className="rm-look-number">
                  {index + 1}
                </span>
                {lookLabel[option]}
              </button>
            ))}
          </div>
          <p className="rm-hint">{lookHint[kind]}</p>
          <p className="rm-credits">
            {t.roomsPicturesFrom}{" "}
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

      {openImage && <OpenPanel image={openImage} shown={infoShown} flat={!has3d} closeRef={closeRef} onClose={close} />}
    </div>
  );
}

/**
 * The opened picture's details. The picture itself is drawn by the room, so
 * this layer only holds the close button and the info bar underneath it.
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
  const title = image.alt || image.credit;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: image.alt || "WEJI", url: image.sourceUrl });
        return;
      }
      await navigator.clipboard.writeText(image.sourceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Cancelled, or no clipboard access: nothing to do.
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className={`rm-open ${shown ? "is-shown" : ""}`}>
      {flat && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.full} alt={image.alt} className="rm-flat-photo" onClick={onClose} />
      )}

      <button ref={closeRef} type="button" onClick={onClose} className="rm-close rm-focus" aria-label={t.viewerClose}>
        <span aria-hidden>×</span>
      </button>

      <div className="rm-info">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white sm:text-base">{title}</p>
          <p className="mt-0.5 truncate text-xs text-white/60">
            {image.source === "anime" ? t.roomsSeries : t.viewerBy} <ExternalLink href={image.creditUrl}>{image.credit}</ExternalLink>{" "}
            {t.viewerOn} <ExternalLink href={image.sourceUrl}>{image.sourceName}</ExternalLink>
            {image.license && (
              <>
                {" · "}
                {image.licenseUrl ? <ExternalLink href={image.licenseUrl}>{image.license}</ExternalLink> : image.license}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void toggleLike(image)} aria-pressed={liked} className={`rm-chip rm-focus ${liked ? "is-liked" : ""}`}>
            <span aria-hidden>{liked ? "♥" : "♡"}</span> {liked ? t.viewerLiked : t.viewerLike}
          </button>
          <SaveMenu image={image} />
          {isDownloadable(image) ? (
            <DownloadMenu image={image} />
          ) : (
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="rm-go rm-focus">
              {t.roomsNoDownload} ↗
            </a>
          )}
          <button type="button" onClick={() => void share()} className="rm-chip rm-focus">
            {copied ? t.roomsCopied : t.viewerShare}
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
    <div className="absolute inset-0 grid auto-rows-[10rem] grid-cols-2 gap-2 overflow-y-auto p-2 pt-44 sm:grid-cols-4">
      {images.slice(0, 60).map((image, index) => (
        <button key={image.id} type="button" onClick={() => onOpen(index)} className="overflow-hidden rounded-lg" style={{ backgroundColor: image.color }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.thumb} alt={image.alt} loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}
