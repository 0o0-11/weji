"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { BloomScene, type BloomPicture, type BloomTier } from "./scene";

export interface BloomCanvasControls {
  rebloom: (pictures: BloomPicture[]) => void;
  closePortal: () => void;
}

interface BloomCanvasProps {
  pictures: BloomPicture[];
  tier: BloomTier;
  reducedMotion: boolean;
  /**
   * Filled in once the scene exists. A plain object ref rather than React's
   * `ref`, because next/dynamic does not forward refs to the loaded component.
   */
  controls: MutableRefObject<BloomCanvasControls | null>;
  onOpen: (pictureIndex: number) => void;
  onClosed: () => void;
}

/**
 * Mounts the three.js bloom into a full-size box. Loaded only in the browser
 * and only after the page has painted, so the 3D engine never delays the first
 * frame a visitor sees.
 */
export default function BloomCanvas({ pictures, tier, reducedMotion, controls, onOpen, onClosed }: BloomCanvasProps) {
  const host = useRef<HTMLDivElement>(null);

  // Latest callbacks, read by the scene without rebuilding it.
  const callbacks = useRef({ onOpen, onClosed });
  callbacks.current = { onOpen, onClosed };

  // The first picture set; later sets arrive through rebloom().
  const initialPictures = useRef(pictures);

  useEffect(() => {
    if (!host.current) return;
    const scene = new BloomScene(host.current, initialPictures.current, {
      tier,
      reducedMotion,
      onOpen: (index) => callbacks.current.onOpen(index),
      onClosed: () => callbacks.current.onClosed(),
    });
    controls.current = {
      rebloom: (next) => scene.rebloom(next),
      closePortal: () => scene.closePortal(),
    };
    // Development only: lets automated checks find tiles on screen.
    const debug = window as unknown as { __bloom?: BloomScene };
    if (process.env.NODE_ENV === "development") debug.__bloom = scene;
    return () => {
      controls.current = null;
      if (debug.__bloom === scene) delete debug.__bloom;
      scene.dispose();
    };
  }, [tier, reducedMotion, controls]);

  return <div ref={host} className="absolute inset-0" />;
}
