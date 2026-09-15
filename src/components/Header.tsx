"use client";

import Link from "next/link";
import SearchBar from "./SearchBar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  // The wordmark always leads with the reader's own script, with the other
  // script kept alongside it — the brand is genuinely both names.
  const lead = locale === "ar" ? "ويجي" : "WEJI";
  const trail = locale === "ar" ? "WEJI" : "ويجي";

  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`text-glow font-black tracking-tight text-fg ${compact ? "text-lg" : "text-2xl"}`}>{lead}</span>
      <span className={`font-semibold text-gold ${compact ? "text-sm" : "text-lg"}`}>{trail}</span>
    </span>
  );
}

export function LangSwitch() {
  const { t, toggleLocale } = useLocale();
  return (
    <button
      type="button"
      onClick={toggleLocale}
      className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
      aria-label="Switch language"
    >
      {t.langLabel}
    </button>
  );
}

export default function Header({ query = "", showSearch = true }: { query?: string; showSearch?: boolean }) {
  const { t } = useLocale();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="WEJI home">
          <Wordmark compact />
        </Link>

        {showSearch && (
          <div className="min-w-0 flex-1">
            <SearchBar initialValue={query} size="compact" />
          </div>
        )}

        <nav className="flex shrink-0 items-center gap-2">
          <Link
            href="/home"
            className="hidden rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-fg sm:block"
          >
            {t.navHome}
          </Link>
          <Link
            href="/collections"
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-fg"
          >
            {t.navCollections}
          </Link>
          <LangSwitch />

          {user ? (
            // The avatar is the way in to the account page. A bare "Sign out"
            // gives a signed-in person nowhere to go and nothing to look at.
            <Link
              href="/account"
              title={user.email ?? t.navAccount}
              aria-label={`${t.navAccount}: ${user.email ?? ""}`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-xs font-bold text-gold transition hover:border-gold hover:bg-gold/20"
            >
              {(user.email ?? "?").charAt(0).toUpperCase()}
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-gold/50 hover:text-gold"
            >
              {t.signIn}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
