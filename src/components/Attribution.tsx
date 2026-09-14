"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Provider attribution.
 *
 * Pexels requires "a prominent link to Pexels" on any page using their API, and
 * Unsplash requires being named and linked wherever their photos appear. Plain
 * text naming them is explicitly not enough — these have to be real links, with
 * Unsplash's UTM parameters attached.
 */
export default function Attribution({ className = "" }: { className?: string }) {
  const { t } = useLocale();

  return (
    <p className={`text-center text-[11px] text-faint ${className}`}>
      {t.footerPhotosBy}{" "}
      <a
        href="https://unsplash.com/?utm_source=WEJI&utm_medium=referral"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-line-strong underline-offset-2 transition hover:text-gold"
      >
        Unsplash
      </a>{" "}
      {t.footerAnd}{" "}
      <a
        href="https://www.pexels.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-line-strong underline-offset-2 transition hover:text-gold"
      >
        Pexels
      </a>
      . {t.footerNewsNote}
    </p>
  );
}
