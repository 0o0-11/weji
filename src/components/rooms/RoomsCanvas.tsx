"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { RoomPicture, RoomScene, RoomTier, ScrollDriver } from "./RoomScene";
import { createRoom, type RoomKind } from "./rooms";

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
}

/**
 * Mounts one of the three.js rooms into a full-size box. Loaded only in the
 * browser, after the page has painted. Switching rooms builds the new one with
 * whatever pictures are showing.
 */
export default function RoomsCanvas({ kind, pictures, tier, reducedMotion, scroll, controls, onOpen, onClosing, onClosed }: RoomsCanvasProps) {
  const host = useRef<HTMLDivElement>(null);

  // Latest callbacks and pictures, read by the room without rebuilding it.
  const callbacks = useRef({ onOpen, onClosing, onClosed });
  callbacks.current = { onOpen, onClosing, onClosed };
  const latestPictures = useRef(pictures);
  latestPictures.current = pictures;

  useEffect(() => {
    if (!host.current) return;
    const room = createRoom(kind, host.current, latestPictures.current, {
      tier,
      reducedMotion,
      scroll,
      onOpen: (index) => callbacks.current.onOpen(index),
      onClosing: () => callbacks.current.onClosing(),
      onClosed: () => callbacks.current.onClosed(),
    });
    controls.current = {
      showResults: (next) => room.showResults(next),
      close: () => room.close(),
    };
    // Development only: lets automated checks drive the room.
    const debug = window as unknown as { __room?: RoomScene };
    if (process.env.NODE_ENV === "development") debug.__room = room;
    return () => {
      controls.current = null;
      if (debug.__room === room) delete debug.__room;
      room.dispose();
    };
  }, [kind, tier, reducedMotion, scroll, controls]);

  return <div ref={host} className="absolute inset-0" />;
}
