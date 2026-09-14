"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Header from "./Header";
import ImageCard from "./ImageCard";
import Viewer3D from "./Viewer3D";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
import { MasonrySkeleton } from "./MasonryGrid";
import type { WejiImage } from "@/lib/search/types";

/** One collection, or the special "Liked" view when collectionId is "liked". */
export default function CollectionDetail({ collectionId }: { collectionId: string }) {
  const { t } = useLocale();
  const { ready, collections, listItems, listLikes, removeFrom, toggleLike, likedIds } = useLibrary();

  const [images, setImages] = useState<WejiImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<WejiImage | null>(null);

  const isLiked = collectionId === "liked";
  const collection = collections.find((candidate) => candidate.id === collectionId);
  const title = isLiked
    ? t.likedPictures
    : collection?.isDefault
      ? t.defaultCollectionName
      : (collection?.name ?? t.myCollections);

  const load = useCallback(async () => {
    setLoading(true);
    const next = isLiked ? await listLikes() : await listItems(collectionId);
    setImages(next);
    setLoading(false);
  }, [collectionId, isLiked, listItems, listLikes]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load, likedIds]);

  const remove = async (image: WejiImage) => {
    if (isLiked) await toggleLike(image);
    else await removeFrom(collectionId, image.id);
    setImages((previous) => previous.filter((item) => item.id !== image.id));
  };

  return (
    <>
      <Header />

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-6">
        <Link href="/collections" className="mb-3 inline-block text-xs text-faint transition hover:text-gold">
          ← {t.myCollections}
        </Link>
        <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
          <span className="ms-3 text-sm font-normal text-faint">
            {images.length} {t.pictures}
          </span>
        </h1>

        {loading ? (
          <MasonrySkeleton count={9} />
        ) : images.length === 0 ? (
          <div className="py-20 text-center">
            <p className="mb-2 text-lg font-bold">{isLiked ? t.emptyLikes : t.emptyCollection}</p>
            <p className="mb-6 text-sm text-faint">{isLiked ? t.emptyLikesBody : t.emptyCollectionBody}</p>
            <Link
              href="/home"
              className="rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-ink transition hover:bg-gold-deep"
            >
              {t.heroCta}
            </Link>
          </div>
        ) : (
          <div className="masonry">
            {images.map((image) => (
              <div key={image.id} className="group/item relative">
                <ImageCard image={image} onSelect={setActive} />
                <button
                  type="button"
                  onClick={() => void remove(image)}
                  aria-label={t.removeFromCollection}
                  className="absolute end-2 top-2 hidden h-8 w-8 place-items-center rounded-full border border-line-strong bg-ink/85 text-sm text-muted backdrop-blur transition hover:border-red-500/50 hover:text-red-400 group-hover/item:grid"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Viewer3D image={active} onClose={() => setActive(null)} />
    </>
  );
}
