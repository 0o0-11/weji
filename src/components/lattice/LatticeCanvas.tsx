"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { LatticeScene, type LatticePicture, type LatticeTier, type ScrollDriver } from "./scene";

export interface LatticeControls {
  showResults: (pictures: LatticePicture[]) => void;
  close: () => void;
}

interface LatticeCanvasProps {
  pictures: LatticePicture[];
  tier: LatticeTier;
  reducedMotion: boolean;
  direction: 1 | -1;
  scroll: ScrollDriver | null;
  /**
   * Filled in once the scene exists. A plain object ref rather than React's
   * `ref`, because next/dynamic does not forward refs to the loaded component.
   */
  controls: MutableRefObject<LatticeControls | null>;
  onOpen: (pictureIndex: number) => void;
  onClosing: () => void;
  onClosed: () => void;
  onFirstTurn: () => void;
}

/**
 * Mounts the three.js lattice into a full-size box. Loaded only in the browser
 * and only after the page has painted, so the 3D engine never delays the first
 * frame a visitor sees.
 */
export default function LatticeCanvas({
  pictures,
  tier,
  reducedMotion,
  direction,
  scroll,
  controls,
  onOpen,
  onClosing,
  onClosed,
  onFirstTurn,
}: LatticeCanvasProps) {
  const host = useRef<HTMLDivElement>(null);

  // Latest callbacks, read by the scene without rebuilding it.
  const callbacks = useRef({ onOpen, onClosing, onClosed, onFirstTurn });
  callbacks.current = { onOpen, onClosing, onClosed, onFirstTurn };

  // Whatever is showing when the scene is (re)built; later sets arrive through showResults().
  const latestPictures = useRef(pictures);
  latestPictures.current = pictures;

  useEffect(() => {
    if (!host.current) return;
    const scene = new LatticeScene(host.current, latestPictures.current, {
      tier,
      reducedMotion,
      direction,
      scroll,
      onOpen: (index) => callbacks.current.onOpen(index),
      onClosing: () => callbacks.current.onClosing(),
      onClosed: () => callbacks.current.onClosed(),
      onFirstTurn: () => callbacks.current.onFirstTurn(),
    });
    controls.current = {
      showResults: (next) => scene.showResults(next),
      close: () => scene.close(),
    };
    // Development only: lets automated checks find pictures on screen.
    const debug = window as unknown as { __lattice?: LatticeScene };
    if (process.env.NODE_ENV === "development") debug.__lattice = scene;
    return () => {
      controls.current = null;
      if (debug.__lattice === scene) delete debug.__lattice;
      scene.dispose();
    };
  }, [tier, reducedMotion, direction, scroll, controls]);

  return <div ref={host} className="absolute inset-0" />;
}
