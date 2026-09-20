"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import DownloadMenu from "@/components/DownloadMenu";
import SaveMenu from "@/components/SaveMenu";
import { isDownloadable } from "@/lib/download";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
import type { WejiImage } from "@/lib/search/types";

/**
 * The opened picture.
 *
 * It grows out of the exact card that was tapped and settles in the middle of
 * the screen, with its own colours flooding the space behind it; closing folds
 * it back into the same card. On a phone you can swipe it away, and swipe
 * sideways for the next picture.
 */

const OPEN_MS = 520;
const CLOSE_MS = 380;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

interface PhotoViewProps {
  image: WejiImage;
  /** Where the picture's card is right now, so it can fly to and from it. */
  cardRect: () => DOMRect | null;
  onClose: () => void;
  onStep: (direction: 1 | -1) => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export default function PhotoView({ image, cardRect, onClose, onStep, hasNext, hasPrevious }: PhotoViewProps) {
  const { t, dir } = useLocale();
  const { isLiked, toggleLike } = useLibrary();
  const overlay = useRef<HTMLDivElement>(null);
  const figure = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const liked = isLiked(image.id);
  const title = image.alt || image.credit;

  // Grow out of the card that was tapped.
  useLayoutEffect(() => {
    const element = figure.current;
    const from = cardRect();
    if (!element) return;
    const to = element.getBoundingClientRect();
    overlay.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: "ease-out" });
    if (!from || to.width === 0) return;
    element.animate(
      [
        {
          transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
          borderRadius: "18px",
        },
        { transform: "none", borderRadius: "18px" },
      ],
      { duration: OPEN_MS, easing: EASE },
    );
  }, [cardRect]);

  const close = useCallback(() => {
    const element = figure.current;
    const to = cardRect();
    if (!element || !to || closing) {
      onClose();
      return;
    }
    setClosing(true);
    const from = element.getBoundingClientRect();
    overlay.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: "ease-in", fill: "forwards" });
    const flight = element.animate(
      [
        { transform: "none" },
        {
          transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`,
        },
      ],
      { duration: CLOSE_MS, easing: EASE, fill: "forwards" },
    );
    flight.onfinish = () => onClose();
  }, [cardRect, closing, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") onStep(dir === "rtl" ? -1 : 1);
      if (event.key === "ArrowLeft") onStep(dir === "rtl" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, onStep, dir]);

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

  // Swipe: down to close, sideways for the next picture.
  const onPointerDown = (event: React.PointerEvent) => {
    if (event.pointerType !== "touch") return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const state = drag.current;
    const element = figure.current;
    if (!state || state.id !== event.pointerId || !element) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.moved && Math.hypot(dx, dy) > 8) state.moved = true;
    if (!state.moved) return;
    if (Math.abs(dy) > Math.abs(dx)) {
      element.style.transform = `translateY(${dy}px) scale(${Math.max(0.82, 1 - Math.abs(dy) / 1200)})`;
      if (overlay.current) overlay.current.style.opacity = `${Math.max(0.25, 1 - Math.abs(dy) / 500)}`;
    } else {
      element.style.transform = `translateX(${dx * 0.4}px)`;
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const state = drag.current;
    const element = figure.current;
    drag.current = null;
    if (!state || state.id !== event.pointerId || !element) return;
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    element.style.transform = "";
    if (overlay.current) overlay.current.style.opacity = "";
    if (Math.abs(dy) > 110 && Math.abs(dy) > Math.abs(dx)) {
      close();
    } else if (Math.abs(dx) > 70) {
      onStep(dx < 0 ? 1 : -1);
    }
  };

  return (
    <div
      ref={overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="wj-photo"
      style={{ "--wj-photo-colour": image.color } as React.CSSProperties}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div aria-hidden className="wj-photo-wash" style={{ backgroundImage: `url(${image.thumb})` }} />

      <button type="button" onClick={close} className="wj-close wj-focus" aria-label={t.viewerClose}>
        <span aria-hidden>×</span>
      </button>

      {hasPrevious && (
        <button type="button" onClick={() => onStep(-1)} className="wj-step wj-step-start wj-focus" aria-label={t.roomsPrevious}>
          <span aria-hidden>‹</span>
        </button>
      )}
      {hasNext && (
        <button type="button" onClick={() => onStep(1)} className="wj-step wj-step-end wj-focus" aria-label={t.roomsNext}>
          <span aria-hidden>›</span>
        </button>
      )}

      <div
        ref={figure}
        className="wj-figure"
        style={{ aspectRatio: `${Math.max(0.35, Math.min(3, image.width / image.height || 1.4))}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.thumb} alt="" aria-hidden className="wj-figure-blur" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.full}
          alt={image.alt}
          className={"wj-figure-full" + (fullLoaded ? " is-loaded" : "")}
          draggable={false}
          onLoad={() => setFullLoaded(true)}
        />
      </div>

      <div className="wj-details">
        <div className="min-w-0 flex-1">
          <p className="wj-details-title">{title}</p>
          <p className="wj-details-credit">
            {image.source === "anime" ? t.roomsSeries : t.viewerBy}{" "}
            <a href={image.creditUrl} target="_blank" rel="noopener noreferrer">
              {image.credit}
            </a>{" "}
            {t.viewerOn}{" "}
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
              {image.sourceName}
            </a>
            {image.license && (
              <>
                {" · "}
                {image.licenseUrl ? (
                  <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">
                    {image.license}
                  </a>
                ) : (
                  image.license
                )}
              </>
            )}
          </p>
        </div>
        <div className="wj-actions">
          <button type="button" onClick={() => void toggleLike(image)} aria-pressed={liked} className={`wj-chip wj-focus ${liked ? "is-liked" : ""}`}>
            <span aria-hidden>{liked ? "♥" : "♡"}</span> {liked ? t.viewerLiked : t.viewerLike}
          </button>
          <SaveMenu image={image} />
          {isDownloadable(image) ? (
            <DownloadMenu image={image} />
          ) : (
            <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" className="wj-go wj-focus">
              {t.roomsNoDownload} ↗
            </a>
          )}
          <button type="button" onClick={() => void share()} className="wj-chip wj-focus">
            {copied ? t.roomsCopied : t.viewerShare}
          </button>
        </div>
      </div>
    </div>
  );
}
