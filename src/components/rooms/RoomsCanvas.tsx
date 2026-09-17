"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { RoomPicture, RoomScene, RoomTier, ScrollDriver } from "./RoomScene";
import type { RoomKind } from "./kinds";
import { createRoom } from "./rooms";
import { THEME } from "./theme";

export interface RoomControls {
  showResults: (pictures: RoomPicture[]) => void;
  close: () => void;
}

interface RoomsCanvasProps {
  kind: RoomKind;
  pictures: RoomPicture[];
  tier: RoomTier;
  reducedMotion: boolean;
  scroll: ScrollDriver;
  /**
   * Filled in once the room exists. A plain object ref rather than React's
   * `ref`, because next/dynamic does not forward refs to the loaded component.
   */
  controls: MutableRefObject<RoomControls | null>;
  onOpen: (pictureIndex: number) => void;
  onClosing: () => void;
  onClosed: () => void;
  onInteract: () => void;
  onCentre: (pictureIndex: number) => void;
}

/**
 * Mounts one of the three.js looks into a full-size box. Loaded only in the
 * browser, after the page has painted; switching looks builds the new one with
 * whatever pictures are showing.
 */
export default function RoomsCanvas({ kind, pictures, tier, reducedMotion, scroll, controls, onOpen, onClosing, onClosed, onInteract, onCentre }: RoomsCanvasProps) {
  const host = useRef<HTMLDivElement>(null);

  // Latest callbacks and pictures, read by the room without rebuilding it.
  const callbacks = useRef({ onOpen, onClosing, onClosed, onInteract, onCentre });
  callbacks.current = { onOpen, onClosing, onClosed, onInteract, onCentre };
  const latestPictures = useRef(pictures);
  latestPictures.current = pictures;

  useEffect(() => {
    if (!host.current) return;
    const scene = createRoom(kind, host.current, latestPictures.current, {
      tier,
      reducedMotion,
      scroll,
      palette: THEME,
      onOpen: (index) => callbacks.current.onOpen(index),
      onClosing: () => callbacks.current.onClosing(),
      onClosed: () => callbacks.current.onClosed(),
      onInteract: () => callbacks.current.onInteract(),
      onCentre: (index) => callbacks.current.onCentre(index),
    });
    controls.current = {
      showResults: (next) => scene.showResults(next),
      close: () => scene.close(),
    };
    // Development only: lets automated checks drive the room.
    const debug = window as unknown as { __room?: RoomScene };
    if (process.env.NODE_ENV === "development") debug.__room = scene;
    return () => {
      controls.current = null;
      if (debug.__room === scene) delete debug.__room;
      scene.dispose();
    };
  }, [kind, tier, reducedMotion, scroll, controls]);

  return <div ref={host} className="absolute inset-0" />;
}
