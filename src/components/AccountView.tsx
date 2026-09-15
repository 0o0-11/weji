"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "./Header";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";

/**
 * The account page.
 *
 * It works signed out as well as signed in — a guest still has collections,
 * likes and followed topics, they just live on the device. Showing them the
 * same numbers either way is what makes the invitation to sign up concrete
 * rather than abstract.
 */
export default function AccountView() {
  const { t, locale, toggleLocale } = useLocale();
  const { user, loading, configured, signOut } = useAuth();
  const { collections, savedIds, likedIds, topics } = useLibrary();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // savedIds is a de-duplicated set across collections; the per-collection
  // counts add up to the number of saves, which is the more useful figure.
  useEffect(() => {
    setSavedCount(collections.reduce((total, collection) => total + (collection.count ?? 0), 0));
  }, [collections]);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
      router.push("/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(user.created_at))
    : null;

  return (
    <>
      <Header />

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">{t.accountTitle}</h1>

        {/* Identity */}
        <section className="mb-6 rounded-2xl border border-line bg-panel p-6">
          {loading ? (
            <div className="shimmer h-12 rounded-lg" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <div
                aria-hidden
                className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-xl font-bold text-gold"
              >
                {(user.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-faint">{t.signedInAs}</p>
                <p className="truncate text-base font-semibold text-fg" dir="ltr">
                  {user.email}
                </p>
                {memberSince && (
                  <p className="mt-0.5 text-xs text-faint">
                    {t.memberSince} {memberSince}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-base font-semibold">{t.accountNotSignedIn}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {configured ? t.accountNotSignedInBody : t.authUnavailableBody}
              </p>
              {configured && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href="/signup"
                    className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-ink transition hover:bg-gold-deep"
                  >
                    {t.signUp}
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
                  >
                    {t.signIn}
                  </Link>
                </div>
              )}
            </>
          )}
        </section>

        {/* What's in the library */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t.statCollections} value={collections.length} href="/collections" />
          <Stat label={t.statSaved} value={savedCount} href="/collections" />
          <Stat label={t.statLiked} value={likedIds.size} href="/collections/liked" />
          <Stat label={t.statTopics} value={topics.length} href="/home" />
        </section>

        {!user && (savedIds.size > 0 || likedIds.size > 0 || topics.length > 0) && (
          <p className="mb-6 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-sm leading-relaxed text-muted">
            {t.accountGuestNote}
          </p>
        )}

        {/* Settings */}
        <section className="rounded-2xl border border-line bg-panel">
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <span className="text-sm font-semibold">{t.accountLanguage}</span>
            <button
              type="button"
              onClick={toggleLocale}
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
            >
              {locale === "ar" ? "العربية · عربي" : "English · EN"} ⇄
            </button>
          </div>

          {user && (
            <div className="flex items-center justify-between gap-4 border-t border-line px-6 py-5">
              <span className="text-sm font-semibold">{t.signOut}</span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
              >
                {busy ? t.working : t.signOut}
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-line bg-panel px-4 py-4 transition hover:-translate-y-0.5 hover:border-gold/40"
    >
      <p className="text-2xl font-bold tabular-nums text-gold">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-faint">{label}</p>
    </Link>
  );
}
