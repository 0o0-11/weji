"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { WejiImage } from "@/lib/search/types";
import { localBackend, localHasContent, migrateLocalToRemote } from "./localBackend";
import { createSupabaseBackend } from "./supabaseBackend";
import type { Collection, LibraryBackend } from "./types";

interface LibraryValue {
  ready: boolean;
  /** True while saves live on this device only (nobody signed in). */
  isLocal: boolean;
  collections: Collection[];
  likedIds: Set<string>;
  savedIds: Set<string>;
  isLiked: (imageId: string) => boolean;
  isSaved: (imageId: string) => boolean;
  toggleLike: (image: WejiImage) => Promise<void>;
  saveTo: (collectionId: string, image: WejiImage) => Promise<void>;
  removeFrom: (collectionId: string, imageId: string) => Promise<void>;
  createCollection: (name: string) => Promise<Collection | null>;
  deleteCollection: (id: string) => Promise<void>;
  listItems: (collectionId: string) => Promise<WejiImage[]>;
  listLikes: () => Promise<WejiImage[]>;
  refresh: () => Promise<void>;
}

const LibraryContext = createContext<LibraryValue | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, client: supabase } = useAuth();

  const [ready, setReady] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Which store we're talking to right now.
  const backend = useMemo<LibraryBackend>(() => {
    if (user && supabase) return createSupabaseBackend(supabase, user.id);
    return localBackend;
  }, [user, supabase]);

  const isLocal = !user;
  const migratedFor = useRef<string | null>(null);

  const load = useCallback(
    async (target: LibraryBackend) => {
      const [nextCollections, snapshot] = await Promise.all([target.listCollections(), target.snapshot()]);
      setCollections(nextCollections);
      setLikedIds(new Set(snapshot.likedIds));
      setSavedIds(new Set(snapshot.savedIds));
      setReady(true);
    },
    [],
  );

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    (async () => {
      try {
        // The first time someone signs in, carry anything they saved as a guest
        // into their account instead of silently losing it.
        if (user && migratedFor.current !== user.id && (await localHasContent())) {
          migratedFor.current = user.id;
          await migrateLocalToRemote(backend);
        }
        if (!active) return;
        await load(backend);
      } catch {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [authLoading, user, backend, load]);

  const value = useMemo<LibraryValue>(() => {
    const refresh = () => load(backend);

    return {
      ready,
      isLocal,
      collections,
      likedIds,
      savedIds,
      isLiked: (imageId) => likedIds.has(imageId),
      isSaved: (imageId) => savedIds.has(imageId),

      async toggleLike(image) {
        const liked = likedIds.has(image.id);
        // Optimistic: the heart must respond on the tap, not on the round trip.
        setLikedIds((previous) => {
          const next = new Set(previous);
          if (liked) next.delete(image.id);
          else next.add(image.id);
          return next;
        });
        try {
          await backend.setLike(image, !liked);
        } catch {
          setLikedIds((previous) => {
            const next = new Set(previous);
            if (liked) next.add(image.id);
            else next.delete(image.id);
            return next;
          });
        }
      },

      async saveTo(collectionId, image) {
        setSavedIds((previous) => new Set(previous).add(image.id));
        try {
          await backend.saveItem(collectionId, image);
          await refresh();
        } catch {
          await refresh();
        }
      },

      async removeFrom(collectionId, imageId) {
        try {
          await backend.removeItem(collectionId, imageId);
        } finally {
          await refresh();
        }
      },

      async createCollection(name) {
        try {
          const collection = await backend.createCollection(name);
          await refresh();
          return collection;
        } catch {
          return null;
        }
      },

      async deleteCollection(id) {
        try {
          await backend.deleteCollection(id);
        } finally {
          await refresh();
        }
      },

      listItems: (collectionId) => backend.listItems(collectionId),
      listLikes: () => backend.listLikes(),
      refresh,
    };
  }, [backend, collections, likedIds, savedIds, ready, isLocal, load]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used inside <LibraryProvider>");
  return ctx;
}
