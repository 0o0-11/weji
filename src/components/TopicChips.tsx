"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useLibrary } from "@/lib/library/LibraryProvider";
import { CATEGORIES } from "@/lib/search/translate";

/**
 * Topic chips. Each is two controls sharing one pill: the label searches the
 * topic, the button follows it.
 *
 * They are siblings rather than nested, because a button inside a link is
 * invalid HTML that keyboard and screen-reader users cannot operate.
 */
export default function TopicChips({
  center = false,
  showFollow = true,
}: {
  center?: boolean;
  showFollow?: boolean;
}) {
  const { t, locale } = useLocale();
  const { isFollowing, toggleTopic } = useLibrary();

  return (
    <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
      {CATEGORIES.map((category) => {
        const label = locale === "ar" ? category.ar : category.en;
        // Follows are stored against the English term, so switching language
        // never loses them.
        const following = isFollowing(category.query);

        return (
          <div
            key={category.query}
            className={`inline-flex items-stretch overflow-hidden rounded-full border transition ${
              following ? "border-gold/50 bg-gold/5" : "border-line bg-panel/60"
            }`}
          >
            <Link
              href={`/search?q=${encodeURIComponent(locale === "ar" ? category.ar : category.query)}`}
              className={`px-4 py-2 text-sm transition ${
                following ? "text-gold" : "text-muted hover:text-gold"
              }`}
            >
              {label}
            </Link>

            {showFollow && (
              <button
                type="button"
                onClick={() => void toggleTopic(category.query)}
                aria-pressed={following}
                aria-label={`${following ? t.followingTopic : t.followTopic}: ${label}`}
                title={following ? t.followingTopic : t.followTopic}
                className={`border-s px-2.5 text-xs transition ${
                  following
                    ? "border-gold/30 text-gold hover:bg-gold/10"
                    : "border-line text-faint hover:bg-white/5 hover:text-gold"
                }`}
              >
                {following ? "✓" : "+"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
