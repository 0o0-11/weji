/**
 * Strict content filtering — always on, no user override.
 *
 * Two layers:
 *   1. The providers' own safe-search, set to maximum (see providers.ts).
 *   2. This file: a keyword gate on the incoming query and on every result's
 *      own description/tags, in both English and Arabic.
 *
 * Layer 2 exists because provider safe-search is good but not perfect, and a
 * public Arabic-language product carries more reputational and app-store risk
 * than a developer tool does.
 */

/** Terms that make a search itself disallowed. */
const BLOCKED_QUERY_TERMS = [
  // English
  "nude", "nudes", "naked", "nsfw", "porn", "porno", "xxx", "sex", "sexy",
  "erotic", "erotica", "lingerie", "topless", "bikini model", "boudoir",
  "fetish", "hentai", "escort", "strip", "stripper", "onlyfans",
  "gore", "gory", "beheading", "corpse", "dead body", "mutilated", "suicide",
  "self harm", "selfharm", "cutting wrist",
  "cocaine", "heroin", "meth", "drugs syringe",
  // Arabic
  "عاري", "عارية", "جنس",
  "جنسي", "اباحي", "اباحية",
  "سكس", "مثير", "مثيرة",
  "جثة", "دماء", "انتحار",
  "مخدرات",
];

/** Terms that disqualify an individual result, even for an innocent query. */
const BLOCKED_RESULT_TERMS = [
  "nude", "naked", "topless", "nsfw", "erotic", "lingerie", "boudoir",
  "underwear", "bare chest", "bare breast", "sensual", "seductive",
  "gore", "blood", "corpse", "dead body", "wound", "injury", "weapon",
  "gun", "rifle", "pistol", "knife blade", "cigarette", "smoking", "vape",
  "alcohol", "beer", "wine", "whiskey", "vodka", "cocktail", "bar drinks",
  "casino", "gambling", "poker", "syringe", "drug",
];

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[آأإٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True when the user's own search text is disallowed. */
export function isQueryBlocked(query: string): boolean {
  const text = ` ${normalize(query)} `;
  return BLOCKED_QUERY_TERMS.some((term) => text.includes(` ${normalize(term)} `) || text.includes(normalize(term)));
}

/**
 * True when a result should be dropped. `haystack` is everything we know about
 * the picture — its description, alt text and tags, joined together.
 */
export function isResultBlocked(haystack: string): boolean {
  const text = normalize(haystack);
  if (!text) return false;
  return BLOCKED_RESULT_TERMS.some((term) => text.includes(normalize(term)));
}

/** Convenience wrapper used by every provider before returning results. */
export function filterSafe<T>(items: T[], describe: (item: T) => string): T[] {
  return items.filter((item) => !isResultBlocked(describe(item)));
}
