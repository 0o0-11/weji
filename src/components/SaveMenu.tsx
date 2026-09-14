"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
import type { WejiImage } from "@/lib/search/types";

/**
 * "Save to…" — pick a collection, or make a new one without leaving the picture.
 * Making the new-collection field part of the same popover matters: most people
 * decide which board a picture belongs to only once they're looking at it.
 */
export default function SaveMenu({ image, onSaved }: { image: WejiImage; onSaved?: () => void }) {
  const { t } = useLocale();
  const { collections, saveTo, createCollection, isSaved } = useLibrary();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const saved = isSaved(image.id);

  const handleSave = async (collectionId: string) => {
    setBusy(true);
    try {
      await saveTo(collectionId, image);
      setOpen(false);
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const collection = await createCollection(trimmed);
      if (collection) {
        await saveTo(collection.id, image);
        setName("");
        setCreating(false);
        setOpen(false);
        onSaved?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          saved
            ? "rounded-full border border-gold/50 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition"
            : "rounded-full border border-line px-4 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-gold"
        }
      >
        ⊞ {saved ? t.viewerSaved : t.viewerSave}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-full z-20 mb-2 max-h-72 w-60 overflow-y-auto rounded-xl border border-line-strong bg-panel p-1.5 shadow-2xl"
          style={{ insetInlineStart: 0 }}
        >
          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => handleSave(collection.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm text-fg transition hover:bg-white/5 disabled:opacity-50"
            >
              <span className="truncate">
                {collection.isDefault ? t.defaultCollectionName : collection.name}
              </span>
              <span className="shrink-0 text-xs text-faint">{collection.count ?? 0}</span>
            </button>
          ))}

          {creating ? (
            <form onSubmit={handleCreate} className="p-1.5">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t.collectionName}
                maxLength={60}
                className="w-full rounded-lg border border-line-strong bg-ink px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-gold/60"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !name.trim()}
                  className="flex-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-gold-deep disabled:opacity-50"
                >
                  {t.create}
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-fg"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 w-full rounded-lg border border-dashed border-line-strong px-3 py-2 text-sm text-muted transition hover:border-gold/50 hover:text-gold"
            >
              + {t.newCollection}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
