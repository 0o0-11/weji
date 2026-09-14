"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./Header";
import MasonryGrid, { MasonrySkeleton } from "./MasonryGrid";
import Viewer3D from "./Viewer3D";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CATEGORIES } from "@/lib/search/translate";
import type { SearchResponse, WejiImage } from "@/lib/search/types";

type Status = "idle" | "loading" | "loaded" | "blocked";

export default function SearchResults() {
  const { t, locale } = useLocale();
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const raw = params.get("raw") === "1";

  const [images, setImages] = useState<WejiImage[]>([]);
  const [meta, setMeta] = useState<SearchResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [page, setPage] = useState(1);
  const [exhausted, setExhausted] = useState(false);

  // Guards against a slow first request overwriting a newer one's results.
  const requestId = useRef(0);

  const load = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (!query.trim()) return;
      const id = ++requestId.current;
      setStatus("loading");

      try {
        const url = `/api/search?q=${encodeURIComponent(query)}&page=${targetPage}${raw ? "&raw=1" : ""}`;
        const res = await fetch(url);
        const data = (await res.json()) as SearchResponse & { blocked?: boolean };
        if (id !== requestId.current) return;

        if (data.blocked) {
          setStatus("blocked");
          setImages([]);
          return;
        }

        setMeta(data);
        setExhausted(data.images.length === 0);
        setImages((previous) => {
          if (replace) return data.images;
          const seen = new Set(previous.map((image) => image.id));
          return [...previous, ...data.images.filter((image) => !seen.has(image.id))];
        });
        setStatus("loaded");
      } catch {
        if (id !== requestId.current) return;
        setStatus("loaded");
        setExhausted(true);
      }
    },
    [query, raw],
  );

  // A new query resets the list entirely.
  useEffect(() => {
    setImages([]);
    setMeta(null);
    setExhausted(false);
    setPage(1);
    void load(1, true);
  }, [load]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    void load(next, false);
  };

  const [active, setActive] = useState<WejiImage | null>(null);
  const showTranslationNote = meta?.translated && meta.query !== meta.originalQuery;

  return (
    <>
      <Header query={query} />

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t.resultsFor} <span className="text-gold">{query}</span>
          </h1>

          {showTranslationNote && (
            <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-gold/20 bg-gold/5 px-3.5 py-2 text-xs text-muted">
              <span>
                {t.searchedFor} <strong className="text-gold" dir="ltr">{meta.query}</strong>
              </span>
              <span className="text-faint">·</span>
              <span>{t.searchedNote}</span>
              <Link
                href={`/search?q=${encodeURIComponent(query)}&raw=1`}
                className="underline decoration-gold/40 underline-offset-2 transition hover:text-gold"
              >
                {t.searchOriginal}
              </Link>
            </div>
          )}

          {meta?.demo && (
            <p className="mt-3 text-xs text-faint">
              <strong className="text-gold">{t.demoBadge}</strong> — {t.demoBody}
            </p>
          )}
        </header>

        {status === "blocked" ? (
          <EmptyState title={t.blocked} body={t.blockedBody} />
        ) : status === "loading" && images.length === 0 ? (
          <MasonrySkeleton count={15} />
        ) : images.length === 0 ? (
          <>
            <EmptyState title={t.noResults} body={t.noResultsBody} />
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((category) => (
                <Link
                  key={category.query}
                  href={`/search?q=${encodeURIComponent(locale === "ar" ? category.ar : category.query)}`}
                  className="rounded-full border border-line bg-panel/60 px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-gold"
                >
                  {locale === "ar" ? category.ar : category.en}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <MasonryGrid images={images} onSelect={setActive} />

            <div className="mt-10 flex justify-center">
              {!exhausted && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={status === "loading"}
                  className="rounded-full border border-line-strong px-7 py-3 text-sm font-semibold text-fg transition hover:border-gold/60 hover:text-gold disabled:opacity-50"
                >
                  {status === "loading" ? t.loading : t.loadMore}
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <Viewer3D image={active} onClose={() => setActive(null)} />
    </>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-20 text-center">
      <p className="mb-2 text-lg font-bold">{title}</p>
      <p className="text-sm text-faint">{body}</p>
    </div>
  );
}
