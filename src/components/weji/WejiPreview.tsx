"use client";

import Link from "next/link";
import Lenis from "lenis";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CATEGORIES } from "@/lib/search/translate";
import type { SearchResponse, WejiImage } from "@/lib/search/types";
import PictureFeed from "./PictureFeed";
import PhotoView from "./PhotoView";

/**
 * WEJI's picture search: a big search that lands in the middle of the screen,
 * a fast grid of whole pictures under it, and a picture that grows out of its
 * own card when you tap it.
 *
 * Built for speed on a phone first: the pictures are plain images the browser
 * can stream and cache, the grid loads more as you reach the end, and the
 * motion is short and purposeful rather than decorative.
 */

const SOURCE_LABELS: Record<WejiImage["source"], string> = {
  anime: "AniList",
  unsplash: "Unsplash",
  pexels: "Pexels",
  openverse: "Openverse",
  demo: "Picsum",
  news: "News",
};

const TOPIC_QUERIES = ["nature", "architecture", "desert", "space", "cars", "animals", "abstract art"];

type Status = { kind: "results"; count: number; sources: string[]; translated: string | null } | { kind: "empty" } | { kind: "blocked" };

const sourcesOf = (images: WejiImage[]) => [...new Set(images.map((image) => SOURCE_LABELS[image.source]))];

export default function WejiPreview({ initialImages }: { initialImages: WejiImage[] }) {
  const { t, locale, toggleLocale } = useLocale();

  const [images, setImages] = useState(initialImages);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [docked, setDocked] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const cards = useRef(new Map<number, HTMLElement>());
  const sentinel = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingMore = useRef(false);

  const registerCard = useCallback((index: number, element: HTMLElement | null) => {
    if (element) cards.current.set(index, element);
    else cards.current.delete(index);
  }, []);

  // Smooth, weighted wheel scrolling on a computer; phones keep their own.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;
    const lenis = new Lenis({ smoothWheel: true, syncTouch: false, lerp: 0.12, autoRaf: true });
    return () => lenis.destroy();
  }, []);

  // The search starts in the middle of the screen and docks to the top once you move.
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 40) setDocked(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("wj-locked", openIndex !== null);
    return () => document.body.classList.remove("wj-locked");
  }, [openIndex]);

  const fetchPage = useCallback(
    async (searchQuery: string | null, nextPage: number) => {
      const url = searchQuery
        ? `/api/search?q=${encodeURIComponent(searchQuery)}&size=wide&page=${nextPage}`
        : `/api/curated?page=${nextPage}&perPage=40`;
      const response = await fetch(url);
      const data = (await response.json()) as Partial<SearchResponse> & { blocked?: boolean };
      return data;
    },
    [],
  );

  const search = async (text: string, chosenTopic: string | null) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setTopic(chosenTopic);
    setDocked(true);
    inputRef.current?.blur();
    try {
      const data = await fetchPage(trimmed, 1);
      if (data.blocked) {
        setStatus({ kind: "blocked" });
        return;
      }
      const next = (data.images ?? []).filter((image) => image.source !== "news");
      if (next.length === 0) {
        setStatus({ kind: "empty" });
        return;
      }
      cards.current.clear();
      setImages(next);
      setActiveQuery(trimmed);
      setPage(1);
      setHasMore(true);
      setStatus({ kind: "results", count: next.length, sources: sourcesOf(next), translated: data.translated && data.query ? data.query : null });
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } catch {
      setStatus({ kind: "empty" });
    } finally {
      setBusy(false);
    }
  };

  // More pictures as you reach the end of the grid.
  const loadMore = useCallback(async () => {
    if (loadingMore.current || !hasMore || openIndex !== null) return;
    loadingMore.current = true;
    try {
      const nextPage = page + 1;
      const data = await fetchPage(activeQuery, nextPage);
      const more = (data.images ?? []).filter((image) => image.source !== "news");
      setPage(nextPage);
      if (more.length === 0) {
        setHasMore(false);
        return;
      }
      setImages((current) => {
        const seen = new Set(current.map((image) => image.id));
        return [...current, ...more.filter((image) => !seen.has(image.id))];
      });
    } catch {
      setHasMore(false);
    } finally {
      loadingMore.current = false;
    }
  }, [activeQuery, fetchPage, hasMore, openIndex, page]);

  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "800px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadMore]);

  const openImage = openIndex === null ? null : (images[openIndex] ?? null);

  const cardRect = useCallback(() => {
    if (openIndex === null) return null;
    const card = cards.current.get(openIndex);
    return card ? card.getBoundingClientRect() : null;
  }, [openIndex]);

  const step = useCallback(
    (direction: 1 | -1) => {
      setOpenIndex((current) => {
        if (current === null) return current;
        const next = current + direction;
        if (next < 0 || next >= images.length) return current;
        // Keep the grid on the new picture, so closing folds back into view.
        cards.current.get(next)?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        return next;
      });
    },
    [images.length],
  );

  const statusText = useMemo(() => {
    if (!status) return null;
    if (status.kind === "blocked") return t.roomsBlocked;
    if (status.kind === "empty") return t.roomsNothing;
    const translated = status.translated ? `${t.searchedFor} “${status.translated}” · ` : "";
    return `${translated}${status.count}+ ${t.roomsPictures} · ${status.sources.join(" · ")}`;
  }, [status, t]);

  const topics = [
    { label: t.roomsAnime, query: "anime" },
    ...TOPIC_QUERIES.map((value) => {
      const category = CATEGORIES.find((candidate) => candidate.query === value)!;
      return { label: locale === "ar" ? category.ar : category.en, query: category.query };
    }),
  ];

  return (
    <div className={`wj ${docked ? "is-docked" : ""}`}>
      <header className="wj-header">
        <Link href="/" className="wj-brand wj-focus">
          <span className="wj-brand-latin">WEJI</span>
          <span className="wj-brand-arabic">ويجي</span>
        </Link>
        <div className="wj-header-actions">
          <button type="button" onClick={toggleLocale} className="wj-link wj-focus">
            {t.langLabel}
          </button>
          <Link href="/account" className="wj-avatar wj-focus" aria-label={t.roomsAccount} title={t.roomsAccount}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="wj-hero">
        <h1 className="wj-headline">{t.roomsHeadline}</h1>
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void search(query, null);
          }}
          className="wj-search"
        >
          <svg className="wj-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
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
          <button type="submit" disabled={busy} className="wj-go wj-focus" aria-label={t.searchAction}>
            {busy ? <span className="wj-spinner" aria-hidden /> : <span aria-hidden>→</span>}
          </button>
        </form>
        <div className="wj-topics">
          {topics.map((entry) => (
            <button
              key={entry.query}
              type="button"
              aria-pressed={topic === entry.query}
              onClick={() => {
                setQuery(entry.label);
                void search(entry.query, entry.query);
              }}
              className="wj-topic wj-focus"
            >
              {entry.label}
            </button>
          ))}
        </div>
        <p className="wj-status" aria-live="polite">
          {statusText}
        </p>
      </div>

      <main className="wj-main">
        <PictureFeed
          images={images}
          onOpen={(index) => setOpenIndex(index)}
          openIndex={openIndex}
          registerCard={registerCard}
          loading={busy}
        />
        <div ref={sentinel} className="wj-sentinel" aria-hidden />
        {!hasMore && <p className="wj-end">{t.roomsEnd}</p>}
      </main>

      <footer className="wj-footer">
        <p>
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

      {openImage && (
        <PhotoView
          key={openImage.id}
          image={openImage}
          cardRect={cardRect}
          onClose={() => setOpenIndex(null)}
          onStep={step}
          hasNext={openIndex !== null && openIndex < images.length - 1}
          hasPrevious={openIndex !== null && openIndex > 0}
        />
      )}
    </div>
  );
}
