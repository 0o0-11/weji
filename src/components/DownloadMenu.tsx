"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { buildDownloadHref, isDownloadable, DOWNLOAD_SIZES } from "@/lib/download";
import type { WejiImage } from "@/lib/search/types";

/** Download the picture sized for a phone, a desktop, or at full resolution. */
export default function DownloadMenu({ image }: { image: WejiImage }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // News pictures belong to their publisher, and anime and open-licence
  // pictures to their creators: WEJI links to the original instead.
  if (!isDownloadable(image)) {
    const isNews = image.source === "news";
    return (
      <a
        href={(isNews && image.articleUrl) || image.sourceUrl || image.creditUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={isNews ? t.downloadNotAllowed : t.roomsNoDownload}
        className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink transition hover:bg-gold-deep"
      >
        {isNews ? t.viewerOpenArticle : t.roomsNoDownload} ↗
      </a>
    );
  }

  const labels: Record<string, string> = {
    phone: t.downloadPhone,
    desktop: t.downloadDesktop,
    original: t.downloadOriginal,
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink transition hover:bg-gold-deep"
      >
        ↓ {t.viewerDownload}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full z-20 mb-2 w-52 rounded-xl border border-line-strong bg-panel p-1.5 shadow-2xl"
          style={{ insetInlineStart: 0 }}
        >
          {DOWNLOAD_SIZES.map((size) => {
            const href = buildDownloadHref(image, size.key);
            if (!href) return null;
            return (
              <a
                key={size.key}
                role="menuitem"
                href={href}
                download
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-fg transition hover:bg-white/5"
              >
                <span>{labels[size.key]}</span>
                <span className="text-xs text-faint" dir="ltr">
                  {size.key === "original" ? `${image.width}×${image.height}` : `${size.width}×${size.height}`}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
