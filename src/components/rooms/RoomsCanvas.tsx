"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { Palette } from "./palettes";
import type { RoomPicture, RoomScene, RoomTier, ScrollDriver } from "./RoomScene";
import { SpaceTunnelRoom } from "./rooms";

export interface RoomControls {
  showResults: (pictures: RoomPicture[]) => void;
  close: () => void;
}

interface RoomsCanvasProps {
  pictures: RoomPicture[];
  palette: Palette;
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
 * Mounts the three.js space tunnel into a full-size box. Loaded only in the
 * browser, after the page has painted.
 */
export default function RoomsCanvas({ pictures, palette, tier, reducedMotion, scroll, controls, onOpen, onClosing, onClosed }: RoomsCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const room = useRef<RoomScene | null>(null);

  // Latest callbacks, pictures and colours, read by the room without rebuilding it.
  const callbacks = useRef({ onOpen, onClosing, onClosed });
  callbacks.current = { onOpen, onClosing, onClosed };
  const latestPictures = useRef(pictures);
  latestPictures.current = pictures;
  const latestPalette = useRef(palette);
  latestPalette.current = palette;

  useEffect(() => {
    if (!host.current) return;
    const scene = new SpaceTunnelRoom(host.current, latestPictures.current, {
      tier,
      reducedMotion,
      scroll,
      palette: latestPalette.current,
      onOpen: (index) => callbacks.current.onOpen(index),
      onClosing: () => callbacks.current.onClosing(),
      onClosed: () => callbacks.current.onClosed(),
    });
    room.current = scene;
    controls.current = {
      showResults: (next) => scene.showResults(next),
      close: () => scene.close(),
    };
    // Development only: lets automated checks drive the room.
    const debug = window as unknown as { __room?: RoomScene };
    if (process.env.NODE_ENV === "development") debug.__room = scene;
    return () => {
      controls.current = null;
      room.current = null;
      if (debug.__room === scene) delete debug.__room;
      scene.dispose();
    };
  }, [tier, reducedMotion, scroll, controls]);

  // Changing colours recolours the room in place; nothing reloads.
  useEffect(() => {
    room.current?.setPalette(palette);
  }, [palette]);

  return <div ref={host} className="absolute inset-0" />;
}
