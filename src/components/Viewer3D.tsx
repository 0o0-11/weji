"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
import DownloadMenu from "./DownloadMenu";
import SaveMenu from "./SaveMenu";
import type { WejiImage } from "@/lib/search/types";

/**
 * The 3D picture viewer. The photograph sits on a plane that tilts toward the
 * pointer, with its own glow projected behind it, so it reads as a physical
 * print held up to the light rather than a flat lightbox.
 */

interface Viewer3DProps {
  image: WejiImage | null;
  onClose: () => void;
}

const MAX_TILT = 9; // degrees

export default function Viewer3D({ image, onClose }: Viewer3DProps) {
  const { t, dir } = useLocale();
  const { isLiked, toggleLike } = useLibrary();
  const plateRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // Escape to close, and lock the page behind the modal.
  useEffect(() => {
    if (!image) return;
    // A cached picture can finish loading before onLoad is attached, which
    // would leave the shimmer covering it forever.
    setLoaded(Boolean(imgRef.current?.complete && imgRef.current.naturalWidth > 0));
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [image, onClose]);

  // Tilt is written straight to the DOM — going through React state here would
  // re-render the whole modal on every mouse move.
  const onPointerMove = (event: React.PointerEvent) => {
    if (event.pointerType === "touch") return;
    const plate = plateRef.current;
    if (!plate) return;
    const rect = plate.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    plate.style.transform = `rotateY(${x * MAX_TILT * 2}deg) rotateX(${-y * MAX_TILT * 2}deg) scale(1.01)`;
  };

  const resetTilt = () => {
    if (plateRef.current) plateRef.current.style.transform = "rotateY(0deg) rotateX(0deg) scale(1)";
  };

  const handleShare = async () => {
    if (!image) return;
    const url = `${window.location.origin}/search?q=${encodeURIComponent(image.alt || "weji")}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: image.alt || "WEJI", url });
        return;
      }
      await navigator.clipboard.writeText(image.creditUrl || url);
      showToast(t.copied);
    } catch {
      // The user dismissed the share sheet, or the clipboard was blocked.
    }
  };

  if (!image) return null;

  const isNews = image.source === "news";
  const liked = isLiked(image.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/92 p-4 backdrop-blur-xl sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || "Picture"}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t.viewerClose}
        className="absolute end-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-full border border-line-strong bg-panel/80 text-xl text-muted transition hover:border-gold/60 hover:text-gold sm:end-8 sm:top-8"
      >
        ✕
      </button>

      <div className="flex max-h-full w-full max-w-5xl flex-col items-center gap-5">
        {/* The 3D plate */}
        <div
          className="scene-3d w-full"
          onPointerMove={onPointerMove}
          onPointerLeave={resetTilt}
          style={{ perspective: "1200px" }}
        >
          {/* `w-fit` makes the plate hug the picture itself. Without it the
              frame and its glow stretch to the full column width and read as a
              hard-edged box floating around the photograph. */}
          <div
            ref={plateRef}
            className="preserve-3d relative mx-auto w-fit max-w-full transition-transform duration-200 ease-out"
          >
            {/* Glow pushed behind the picture in Z, so the light appears to come
                from the photograph itself as the plate turns. */}
            <div
              aria-hidden
              className="breathe pointer-events-none absolute inset-4 rounded-3xl blur-3xl"
              style={{ background: image.color, transform: "translateZ(-80px)", opacity: 0.5 }}
            />
            <div className="relative overflow-hidden rounded-2xl border border-line-strong shadow-[0_40px_120px_-30px_#000]">
              {!loaded && <div className="shimmer absolute inset-0" />}
              <img
                ref={imgRef}
                src={image.full}
                alt={image.alt}
                width={image.width || undefined}
                height={image.height || undefined}
                onLoad={() => setLoaded(true)}
                draggable={false}
                // The intrinsic width/height above let the browser reserve the
                // right space before the picture arrives, so the plate doesn't
                // collapse while it loads.
                className="block h-auto max-h-[62vh] w-auto max-w-full object-contain"
                style={{ backgroundColor: image.color }}
              />
            </div>
          </div>
        </div>

        {/* Caption + actions */}
        <div className="w-full max-w-3xl" dir={dir}>
          {image.alt && <p className="mb-1 text-balance text-center text-sm text-fg sm:text-base">{image.alt}</p>}

          {/* Unsplash and Pexels both require the photographer AND the provider
              to be named and linked, not just mentioned in text. */}
          <p className="mb-4 text-center text-xs text-faint">
            {isNews ? (
              image.outlet
            ) : (
              <>
                {t.viewerBy}{" "}
                <a
                  href={image.creditUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted underline decoration-line-strong underline-offset-2 transition hover:text-gold"
                >
                  {image.credit}
                </a>{" "}
                {t.viewerOn}{" "}
                <a
                  href={image.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted underline decoration-line-strong underline-offset-2 transition hover:text-gold"
                >
                  {image.sourceName}
                </a>
              </>
            )}
            <span className="mx-2 hidden sm:inline">·</span>
            <span className="hidden sm:inline">{t.viewerTiltHint}</span>
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <DownloadMenu image={image} />
            <ActionButton onClick={handleShare}>⤴ {t.viewerShare}</ActionButton>
            <ActionButton active={liked} onClick={() => void toggleLike(image)}>
              {liked ? "♥" : "♡"} {liked ? t.viewerLiked : t.viewerLike}
            </ActionButton>
            <SaveMenu image={image} onSaved={() => showToast(t.savedToast)} />
            {image.sourceUrl && !isNews && (
              <a
                href={image.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-gold"
              >
                {t.viewerSource} ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fade-up pointer-events-none fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-gold/30 bg-panel px-5 py-2.5 text-sm text-fg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition"
          : "rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-gold"
      }
    >
      {children}
    </button>
  );
}
