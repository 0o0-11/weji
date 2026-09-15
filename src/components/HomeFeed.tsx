"use client";

import { useEffect, useMemo, useState } from "react";
import Attribution from "./Attribution";
import Header from "./Header";
import MasonryGrid, { MasonrySkeleton } from "./MasonryGrid";
import TopicChips from "./TopicChips";
import Viewer3D from "./Viewer3D";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
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
  const { topics, ready } = useLibrary();
  const [active, setActive] = useState<WejiImage | null>(null);

  const [forYou, setForYou] = useState<WejiImage[]>([]);
  const [forYouLoading, setForYouLoading] = useState(false);

  // The personalised feed is fetched in the browser rather than rendered on the
  // server: the server has no idea who is reading until the library loads, and
  // the news and popular sections should never wait on it.
  const topicKey = topics.join(",");
  useEffect(() => {
    if (!ready || !topicKey) {
      setForYou([]);
      return;
    }
    let active = true;
    setForYouLoading(true);

    fetch(`/api/foryou?topics=${encodeURIComponent(topicKey)}`)
      .then((response) => response.json())
      .then((data: { images?: WejiImage[] }) => {
        if (active) setForYou(data.images ?? []);
      })
      .catch(() => {
        if (active) setForYou([]);
      })
      .finally(() => {
        if (active) setForYouLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ready, topicKey]);

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

        {/* ── For you ──────────────────────────────────────────────────── */}
        {topicKey && (
          <section className="mb-16">
            <SectionHeading title={t.forYouHeading} subtitle={t.forYouSub} />
            {forYouLoading && forYou.length === 0 ? (
              <MasonrySkeleton count={8} />
            ) : (
              <MasonryGrid images={forYou} onSelect={setActive} />
            )}
          </section>
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
          <SectionHeading title={t.browseHeading} subtitle={topicKey ? undefined : t.followHint} />
          <TopicChips />
        </section>

        {/* ── Popular photographs ──────────────────────────────────────── */}
        {trending.length > 0 && (
          <section id="popular" style={{ scrollMarginTop: "80px" }}>
            <SectionHeading title={t.trendingHeading} subtitle={t.trendingSub} />
            <MasonryGrid images={trending} onSelect={setActive} />
          </section>
        )}

        <Attribution className="mt-16" />
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
