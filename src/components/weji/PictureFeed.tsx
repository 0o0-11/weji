"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WejiImage } from "@/lib/search/types";

/**
 * The grid of pictures: whole pictures, balanced into columns so no column
 * runs long, each one rising into place as it comes into view.
 *
 * Column count follows the width of the screen, so a phone shows two big
 * columns and a wide screen up to five.
 */

const COLUMN_WIDTH = 330;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;

const aspectOf = (image: WejiImage) => {
  const ratio = image.width > 0 && image.height > 0 ? image.width / image.height : 1.4;
  // Very tall or very wide pictures are shown whole, just not endlessly so.
  return Math.min(1.9, Math.max(0.6, ratio));
};

function useColumnCount(container: React.RefObject<HTMLDivElement | null>) {
  const [columns, setColumns] = useState(2);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const count = Math.round(width / COLUMN_WIDTH);
      setColumns(Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, count)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [container]);
  return columns;
}

export interface PictureFeedProps {
  images: WejiImage[];
  /** Given the index in `images`, and the card the picture grew from. */
  onOpen: (index: number, card: HTMLElement) => void;
  /** Hidden while its picture is open, so the two never show at once. */
  openIndex: number | null;
  registerCard: (index: number, element: HTMLElement | null) => void;
  loading?: boolean;
}

export default function PictureFeed({ images, onOpen, openIndex, registerCard, loading }: PictureFeedProps) {
  const container = useRef<HTMLDivElement>(null);
  const columns = useColumnCount(container);

  // Deal each picture into the shortest column, so the columns end level.
  const laidOut = useMemo(() => {
    const buckets: { image: WejiImage; index: number }[][] = Array.from({ length: columns }, () => []);
    const heights = new Array(columns).fill(0);
    images.forEach((image, index) => {
      const shortest = heights.indexOf(Math.min(...heights));
      buckets[shortest].push({ image, index });
      heights[shortest] += 1 / aspectOf(image);
    });
    return buckets;
  }, [images, columns]);

  return (
    <div ref={container} className="wj-feed" style={{ "--wj-columns": columns } as React.CSSProperties}>
      {laidOut.map((bucket, column) => (
        <div className="wj-column" key={column}>
          {bucket.map(({ image, index }) => (
            <Card
              key={image.id}
              image={image}
              index={index}
              hidden={openIndex === index}
              onOpen={onOpen}
              registerCard={registerCard}
            />
          ))}
        </div>
      ))}
      {loading && <div className="wj-loading" aria-hidden />}
    </div>
  );
}

function Card({
  image,
  index,
  hidden,
  onOpen,
  registerCard,
}: {
  image: WejiImage;
  index: number;
  hidden: boolean;
  onOpen: (index: number, card: HTMLElement) => void;
  registerCard: (index: number, element: HTMLElement | null) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    registerCard(index, button.current);
    return () => registerCard(index, null);
  }, [index, registerCard]);

  // Each picture rises into place the first time it comes into view.
  useEffect(() => {
    const element = button.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <button
      ref={button}
      type="button"
      onClick={() => button.current && onOpen(index, button.current)}
      className={`wj-card ${shown ? "is-shown" : ""} ${hidden ? "is-open" : ""}`}
      style={{
        aspectRatio: `${aspectOf(image)}`,
        backgroundColor: image.color,
        animationDelay: `${(index % 10) * 45}ms`,
      }}
      aria-label={image.alt || image.credit}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.thumb} alt={image.alt} loading="lazy" decoding="async" draggable={false} />
      <span className="wj-card-glow" aria-hidden style={{ background: image.color }} />
    </button>
  );
}
