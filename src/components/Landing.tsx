"use client";

import Link from "next/link";
import { useState } from "react";
import Attribution from "./Attribution";
import Hero3D from "./Hero3D";
import SearchBar from "./SearchBar";
import Viewer3D from "./Viewer3D";
import { Wordmark, LangSwitch } from "./Header";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CATEGORIES } from "@/lib/search/translate";
import type { WejiImage } from "@/lib/search/types";

export default function Landing({ images, demo }: { images: WejiImage[]; demo: boolean }) {
  const { t, locale } = useLocale();
  const [active, setActive] = useState<WejiImage | null>(null);

  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Ambient light. Two soft pools of gold keep the near-black page from
          reading as a flat rectangle, and echo the glow on the 3D ring. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 34rem at 50% -12%, #ffc24b1f, transparent 70%)," +
            "radial-gradient(48rem 28rem at 50% 58%, #ff9e2c14, transparent 72%)",
        }}
      />

      <div className="relative">
        {/* Minimal top bar — the landing page shouldn't carry a full app header. */}
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-5 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-2">
            <LangSwitch />
            <Link
              href="/home"
              className="rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
            >
              {t.navHome}
            </Link>
          </div>
        </div>

        {/* Hero copy */}
        <section className="mx-auto max-w-3xl px-5 pt-2 text-center sm:px-8 sm:pt-5">
          <p className="fade-up mb-4 inline-block rounded-full border border-gold/25 bg-gold/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold">
            {t.tagline}
          </p>

          <h1
            className="fade-up text-balance text-[2rem] font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            {t.heroTitle}{" "}
            <span
              className="text-glow"
              style={{
                backgroundImage: "linear-gradient(180deg, #ffc24b, #ff9e2c)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {t.heroTitleAccent}
            </span>
          </h1>

          <p
            className="fade-up mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-muted"
            style={{ animationDelay: "120ms" }}
          >
            {t.heroBody}
          </p>

          <div className="fade-up mx-auto mt-6 max-w-xl" style={{ animationDelay: "180ms" }}>
            <SearchBar size="hero" />
          </div>

          <div
            className="fade-up mt-4 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/home"
              className="glow-gold rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-ink transition hover:bg-gold-deep"
            >
              {t.heroCta}
            </Link>
            <Link
              href="/search?q=wallpaper"
              className="rounded-full border border-line px-6 py-2.5 text-sm font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
            >
              {t.heroSecondary}
            </Link>
          </div>
        </section>

        {/* The 3D scene */}
        <section className="mt-1 sm:mt-3">
          <Hero3D images={images} onSelect={setActive} />
          <p className="mt-1 text-center text-[11px] tracking-wide text-faint">{t.heroHint}</p>
        </section>

        {/* Topic chips */}
        <section className="mx-auto max-w-4xl px-5 pb-16 pt-10 sm:px-8">
          <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-faint">
            {t.browseHeading}
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
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

          {demo && (
            <p className="mx-auto mt-10 max-w-md rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-center text-xs leading-relaxed text-muted">
              <strong className="text-gold">{t.demoBadge}</strong> — {t.demoBody}
            </p>
          )}

          <Attribution className="mt-10" />
        </section>
      </div>

      <Viewer3D image={active} onClose={() => setActive(null)} />
    </main>
  );
}
