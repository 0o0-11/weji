"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function SearchBar({
  initialValue = "",
  size = "hero",
  autoFocus = false,
}: {
  initialValue?: string;
  size?: "hero" | "compact";
  autoFocus?: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(initialValue);

  // Keep the box in step with the URL when the user navigates between searches.
  useEffect(() => setValue(initialValue), [initialValue]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  const hero = size === "hero";

  return (
    <form onSubmit={submit} role="search" className="w-full">
      <div
        className={`group flex items-center gap-2 rounded-full border border-line-strong bg-panel/80 backdrop-blur transition focus-within:border-gold/60 focus-within:shadow-[0_0_40px_-8px_#ffc24b66] hover:border-line-strong ${
          hero ? "px-4 py-2.5 sm:px-5 sm:py-3.5" : "px-3 py-2"
        }`}
      >
        <span aria-hidden className={`text-faint transition group-focus-within:text-gold ${hero ? "text-lg" : "text-sm"}`}>
          ⌕
        </span>

        <input
          type="search"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchAction}
          className={`min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint ${
            hero ? "text-base sm:text-lg" : "text-sm"
          }`}
        />

        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label={t.clear}
            className="text-faint transition hover:text-fg"
          >
            ✕
          </button>
        )}

        <button
          type="submit"
          className={`shrink-0 rounded-full bg-gold font-semibold text-ink transition hover:bg-gold-deep ${
            hero ? "px-5 py-2 text-sm sm:px-6 sm:py-2.5 sm:text-base" : "px-3.5 py-1.5 text-xs"
          }`}
        >
          {t.searchAction}
        </button>
      </div>
    </form>
  );
}
