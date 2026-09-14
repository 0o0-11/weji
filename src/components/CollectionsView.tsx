"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "./Header";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";

export default function CollectionsView() {
  const { t } = useLocale();
  const { user, configured } = useAuth();
  const { ready, isLocal, collections, likedIds, createCollection, deleteCollection, listLikes } = useLibrary();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [likedCover, setLikedCover] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void listLikes().then((likes) => setLikedCover(likes[0]?.thumb ?? null));
  }, [ready, likedIds, listLikes]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await createCollection(name);
    setName("");
    setCreating(false);
  };

  return (
    <>
      <Header />

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.myCollections}</h1>
          {!creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-fg transition hover:border-gold/60 hover:text-gold"
            >
              + {t.newCollection}
            </button>
          )}
        </div>

        {/* Guests can save straight away; this explains where it's going and why
            an account is worth making. */}
        {isLocal && (
          <div className="mb-8 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm">
            <strong className="text-gold">{t.savedOnDevice}</strong>
            <span className="text-muted"> — {configured ? t.savedOnDeviceBody : t.authUnavailableBody}</span>
            {configured && (
              <Link href="/signup" className="ms-2 font-semibold text-gold underline underline-offset-4">
                {t.signUp}
              </Link>
            )}
          </div>
        )}

        {creating && (
          <form onSubmit={onCreate} className="mb-8 flex flex-wrap gap-2">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t.collectionName}
              maxLength={60}
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-panel px-4 py-2.5 text-sm text-fg outline-none placeholder:text-faint focus:border-gold/60"
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-gold-deep disabled:opacity-50"
            >
              {t.create}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-full border border-line px-5 py-2.5 text-sm text-muted transition hover:text-fg"
            >
              {t.cancel}
            </button>
          </form>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <CollectionTile
            href="/collections/liked"
            name={t.likedPictures}
            count={likedIds.size}
            cover={likedCover}
            unit={t.pictures}
            accent
          />

          {collections.map((collection) => (
            <CollectionTile
              key={collection.id}
              href={`/collections/${collection.id}`}
              // The first collection is created for the user, not by them, so
              // its name follows the interface language rather than being stuck
              // in whatever language it was seeded in.
              name={collection.isDefault ? t.defaultCollectionName : collection.name}
              count={collection.count ?? 0}
              cover={collection.cover ?? null}
              unit={t.pictures}
              onDelete={
                collection.isDefault
                  ? undefined
                  : async () => {
                      if (window.confirm(t.deleteConfirm)) await deleteCollection(collection.id);
                    }
              }
              deleteLabel={t.deleteCollection}
            />
          ))}
        </div>

        {ready && collections.length === 0 && likedIds.size === 0 && (
          <p className="py-20 text-center text-sm text-faint">{t.emptyCollectionBody}</p>
        )}

        {user && <p className="mt-16 text-center text-[11px] text-faint" dir="ltr">{user.email}</p>}
      </main>
    </>
  );
}

function CollectionTile({
  href,
  name,
  count,
  cover,
  unit,
  accent,
  onDelete,
  deleteLabel,
}: {
  href: string;
  name: string;
  count: number;
  cover: string | null;
  unit: string;
  accent?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="group relative">
      <Link
        href={href}
        className="block overflow-hidden rounded-xl border border-line bg-panel transition-all duration-300 hover:-translate-y-1 hover:border-gold/40 hover:shadow-[0_18px_50px_-18px_#000]"
      >
        <div className="relative aspect-[4/3] bg-ink-2">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-3xl text-faint">{accent ? "♥" : "⊞"}</div>
          )}
        </div>
        <div className="p-3">
          <p className={`truncate text-sm font-semibold ${accent ? "text-gold" : "text-fg"}`}>{name}</p>
          <p className="text-xs text-faint">
            {count} {unit}
          </p>
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={deleteLabel}
          className="absolute end-2 top-2 hidden h-8 w-8 place-items-center rounded-full border border-line-strong bg-ink/85 text-sm text-muted backdrop-blur transition hover:border-red-500/50 hover:text-red-400 group-hover:grid"
        >
          ✕
        </button>
      )}
    </div>
  );
}
