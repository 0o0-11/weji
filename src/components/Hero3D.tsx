"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WejiImage } from "@/lib/search/types";

/**
 * The WEJI landing scene: a ring of photographs standing in real 3D space that
 * turns by itself and can be grabbed and spun.
 *
 * Built with CSS 3D rather than WebGL. A three.js scene would add roughly
 * 600 KB to the first page a visitor ever loads, which is the single most
 * common reason a "beautiful" landing page feels slow on a mid-range Android.
 * Everything here is composited on the GPU and the whole animation runs off
 * refs, so React never re-renders during the spin.
 */

interface Hero3DProps {
  images: WejiImage[];
  onSelect?: (image: WejiImage) => void;
}

const MAX_TILES = 16;
const AUTO_SPEED = 0.05; // degrees per frame ≈ 3°/second
const DRAG_SENSITIVITY = 0.22;
const FRICTION = 0.94;

export default function Hero3D({ images, onSelect }: Hero3DProps) {
  const tiles = images.slice(0, MAX_TILES);
  const count = tiles.length;

  const hostRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Animation state lives in refs, never in React state — a spinning ring that
  // re-rendered 60 times a second would stall the rest of the page.
  const angleRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const movedRef = useRef(0);

  const [geometry, setGeometry] = useState({ width: 190, height: 264, radius: 480 });
  const [ready, setReady] = useState(false);

  // ── Geometry ────────────────────────────────────────────────────────────
  // Radius is derived so neighbouring tiles just touch: r = (w/2) / tan(π/n).
  useEffect(() => {
    if (count === 0) return;

    const measure = () => {
      const hostWidth = hostRef.current?.clientWidth ?? 1000;
      const width = Math.round(Math.max(120, Math.min(230, hostWidth * 0.19)));
      const height = Math.round(width * 1.38);
      const radius = Math.round(width / 2 / Math.tan(Math.PI / count));
      setGeometry({ width, height, radius });
      setReady(true);
    };

    measure();
    const observer = new ResizeObserver(measure);
    if (hostRef.current) observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, [count]);

  // ── Per-frame paint ─────────────────────────────────────────────────────
  const paint = useCallback(() => {
    const ring = ringRef.current;
    if (!ring) return;
    const angle = angleRef.current;
    ring.style.transform = `translateZ(-${geometry.radius}px) rotateY(${angle}deg)`;

    // Shade each tile by how far it has turned away from the viewer. This is
    // what sells the depth — without it a CSS ring reads as a flat carousel.
    const step = 360 / count;
    for (let i = 0; i < count; i++) {
      const el = tileRefs.current[i];
      if (!el) continue;
      const facing = Math.cos(((angle + i * step) * Math.PI) / 180);
      const front = (facing + 1) / 2; // 0 at the back, 1 at the front
      el.style.opacity = String(0.18 + front * 0.82);
      el.style.filter = `brightness(${(0.42 + front * 0.58).toFixed(3)}) saturate(${(0.55 + front * 0.45).toFixed(3)})`;
    }
  }, [count, geometry.radius]);

  useEffect(() => {
    if (!ready || count === 0) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const tick = () => {
      if (!draggingRef.current) {
        if (Math.abs(velocityRef.current) > 0.01) {
          // Momentum from a flick, decaying to a stop.
          angleRef.current += velocityRef.current;
          velocityRef.current *= FRICTION;
        } else if (!reduceMotion) {
          angleRef.current += AUTO_SPEED;
        }
      }
      paint();
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ready, count, paint]);

  // ── Drag to spin ────────────────────────────────────────────────────────
  const onPointerDown = (event: React.PointerEvent) => {
    draggingRef.current = true;
    lastXRef.current = event.clientX;
    movedRef.current = 0;
    velocityRef.current = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = event.clientX - lastXRef.current;
    lastXRef.current = event.clientX;
    movedRef.current += Math.abs(dx);
    const delta = dx * DRAG_SENSITIVITY;
    angleRef.current += delta;
    velocityRef.current = delta;
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      // Pointer already released.
    }
  };

  /** Suppress the click that ends a drag, so spinning never opens a picture. */
  const handleTileClick = (image: WejiImage) => {
    if (movedRef.current > 6) return;
    onSelect?.(image);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      velocityRef.current = 3;
    } else if (event.key === "ArrowRight") {
      velocityRef.current = -3;
    }
  };

  if (count === 0) return null;

  const step = 360 / count;

  // The scene hugs the tiles once they've been measured. The Tailwind heights
  // are only the first-paint guess, so the section neither collapses nor leaves
  // a band of dead space above and below the ring.
  const sceneHeight = ready ? geometry.height + 104 : undefined;

  return (
    <div
      ref={hostRef}
      style={{ height: sceneHeight }}
      className="scene-3d relative h-[300px] w-full touch-pan-y select-none sm:h-[360px] lg:h-[420px]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      role="region"
      aria-label="Featured pictures, drag to spin"
      tabIndex={0}
    >
      <div
        className="preserve-3d ring-3d absolute left-1/2 top-1/2"
        style={{ transform: `translateZ(-${geometry.radius}px)` }}
        ref={ringRef}
      >
        {tiles.map((image, index) => (
          <button
            key={image.id}
            ref={(el) => {
              tileRefs.current[index] = el;
            }}
            type="button"
            onClick={() => handleTileClick(image)}
            aria-label={image.alt || `Picture ${index + 1}`}
            className="backface-hidden absolute cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-panel shadow-2xl transition-[box-shadow] duration-300 hover:shadow-[0_0_40px_-6px_#ffc24b66]"
            style={{
              width: geometry.width,
              height: geometry.height,
              marginLeft: -geometry.width / 2,
              marginTop: -geometry.height / 2,
              transform: `rotateY(${index * step}deg) translateZ(${geometry.radius}px)`,
            }}
          >
            <img
              src={image.thumb}
              alt=""
              draggable={false}
              loading={index < 6 ? "eager" : "lazy"}
              decoding="async"
              className="pointer-events-none h-full w-full object-cover"
              style={{ backgroundColor: image.color }}
            />
          </button>
        ))}
      </div>

      {/* Fog: fades the ring into the page at both edges and along the floor,
          so it reads as a scene rather than a widget sitting on a rectangle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, #07070a 0%, #07070a00 18%, #07070a00 82%, #07070a 100%)," +
            "linear-gradient(to bottom, #07070a 0%, #07070a00 22%, #07070a00 68%, #07070a 100%)",
        }}
      />
    </div>
  );
}
