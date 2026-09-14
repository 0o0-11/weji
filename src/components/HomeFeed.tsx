"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Header from "./Header";
import MasonryGrid from "./MasonryGrid";
import Viewer3D from "./Viewer3D";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CATEGORIES } from "@/lib/search/translate";
import type { WejiImage } from "@/lib/search/types";

export default function HomeFeed({
  news,
  trending,
  demo,
}: {
  news: WejiImage[];
  trending: WejiImage[];
  demo: boolean;
}) {
  const { t, locale } = useLocale();
  const [active, setActive] = useState<WejiImage | null>(null);

  // Both languages are rendered on the server; we pick the reader's own here so
  // there is no second request and no flash of the wrong language.
  const localisedNews = useMemo(() => {
    const matching = news.filter((item) => item.lang === locale);
    return matching.length >= 8 ? matching : news;
  }, [news, locale]);

  return (
    <>
      <Header />

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-6">
        {demo && (
          <p className="mb-8 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-center text-xs leading-relaxed text-muted">
            <strong className="text-gold">{t.demoBadge}</strong> — {t.demoBody}
          </p>
        )}

        {/* ── News ─────────────────────────────────────────────────────── */}
        {localisedNews.length > 0 && (
          <section className="mb-16">
            <SectionHeading title={t.newsHeading} subtitle={t.newsSub} live />
            <MasonryGrid images={localisedNews} onSelect={setActive} />
          </section>
        )}

        {/* ── Topics ───────────────────────────────────────────────────── */}
        <section className="mb-16">
          <SectionHeading title={t.browseHeading} />
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Link
                key={category.query}
                href={`/search?q=${encodeURIComponent(locale === "ar" ? category.ar : category.query)}`}
                className="rounded-full border border-line bg-panel/60 px-4 py-2 text-sm text-muted transition hover:-translate-y-0.5 hover:border-gold/50 hover:text-gold"
              >
                {locale === "ar" ? category.ar : category.en}
              </Link>
            ))}
          </div>
        </section>

        {/* ── Trending wallpapers ──────────────────────────────────────── */}
        {trending.length > 0 && (
          <section>
            <SectionHeading title={t.trendingHeading} subtitle={t.trendingSub} />
            <MasonryGrid images={trending} onSelect={setActive} />
          </section>
        )}

        <p className="mt-16 text-center text-[11px] text-faint">{t.footerNote}</p>
      </main>

      <Viewer3D image={active} onClose={() => setActive(null)} />
    </>
  );
}

function SectionHeading({ title, subtitle, live }: { title: string; subtitle?: string; live?: boolean }) {
  return (
    <div className="mb-5">
      <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight sm:text-2xl">
        {title}
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">
            <span className="breathe inline-block h-1.5 w-1.5 rounded-full bg-gold" />
            Live
          </span>
        )}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-faint">{subtitle}</p>}
    </div>
  );
}
