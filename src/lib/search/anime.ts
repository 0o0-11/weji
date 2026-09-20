import type { WejiImage } from "./types";
import { isResultBlocked } from "./safety";

/**
 * Anime, manga and manhwa pictures from AniList.
 *
 * Stock libraries have no anime characters at all, so without this a search
 * like "Park Jonggun" can never succeed. AniList is free and has no key, but
 * its search is spelling-sensitive: it knows that character as "Jong-Geon
 * Park" (alias "Jong-Gun Park"). A person types "Park Jonggun" — Korean order,
 * given name run together — and gets nothing. So we try the likely spellings
 * in a single request and keep only results that genuinely match, so that a
 * search like "sunset" never fills with unrelated anime.
 *
 * Pictures are shown as search results that link back to AniList. They belong
 * to their creators, so they are never offered as downloads.
 */

const ENDPOINT = "https://graphql.anilist.co";
const TIMEOUT_MS = 7000;

/**
 * A one-word search is ambiguous: "sunset" is also a minor character called
 * Sunset Shimmer. For one word we only trust well-known characters and
 * series, so everyday searches are never taken over by anime.
 */
const MIN_CHARACTER_FAVOURITES = 300;
const MIN_MEDIA_POPULARITY = 5000;

interface AniCharacter {
  id: number;
  name: { full: string | null; native: string | null; alternative: (string | null)[] | null };
  image: { large: string | null } | null;
  siteUrl: string;
  favourites: number | null;
  media?: { nodes: AniMediaLite[] } | null;
}

interface AniMediaLite {
  id: number;
  type: "ANIME" | "MANGA";
  siteUrl: string;
  bannerImage: string | null;
  title: { romaji: string | null; english: string | null } | null;
  isAdult: boolean | null;
  coverImage?: { extraLarge: string | null; color: string | null } | null;
}

interface AniMedia {
  id: number;
  type: "ANIME" | "MANGA";
  isAdult: boolean | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { extraLarge: string | null; color: string | null } | null;
  bannerImage: string | null;
  siteUrl: string;
  popularity: number | null;
  characters: { nodes: AniCharacter[] } | null;
}

/** Lower-case letters and digits only, so "Jong-Gun Park" and "jonggun park" compare equal. */
const squash = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "");

const tokensOf = (text: string) =>
  text
    .toLowerCase()
    .split(/[\s\-_.,·]+/)
    .map((token) => token.trim())
    .filter(Boolean);

/**
 * Split a run-together romanised Korean given name into syllables, the way
 * AniList stores them: "jonggun" → "jong gun", "seongji" → "seong ji".
 * Only splits after a Korean final sound and before a consonant, so ordinary
 * words like "daniel" are left alone.
 */
function splitKoreanGivenName(token: string): string | null {
  if (!/^[a-z]{5,10}$/.test(token)) return null;
  // Syllable = consonants, vowels, then an optional final sound — taken only
  // when a consonant (or the end) follows, so "jonggun" reads jong|gun, not jo|nggun.
  const syllables = token.match(/[^aeiouy]*[aeiouy]+(?:(?:ng|n|m|l|k|p|t)(?=[^aeiouy]|$))?/g);
  if (!syllables || syllables.length !== 2 || syllables.join("") !== token) return null;
  return syllables.join(" ");
}

/** The query as typed, plus the name orders and syllable splits AniList is likely to use. */
export function nameVariants(query: string): string[] {
  const tokens = tokensOf(query);
  const variants = new Set<string>([query.trim()]);
  if (tokens.length === 2 || tokens.length === 3) {
    const reversed = [...tokens.slice(1), tokens[0]];
    variants.add(reversed.join(" "));
    const split = reversed.map((token) => splitKoreanGivenName(token) ?? token).join(" ");
    variants.add(split);
  }
  return [...variants].filter(Boolean).slice(0, 3);
}

/**
 * Every word searched must be a whole word of one of the character's names
 * ("luffy" matches "Luffy Monkey"), or the whole search must equal a name once
 * spaces and hyphens are ignored ("jonggun park" matches "Jong-Gun Park").
 */
function characterMatches(character: AniCharacter, queryTokens: string[]): boolean {
  const names = [character.name.full, character.name.native, ...(character.name.alternative ?? [])].filter(
    (name): name is string => Boolean(name),
  );
  const squashedQuery = squash(queryTokens.join(""));
  return names.some((name) => {
    const words = tokensOf(name);
    return queryTokens.every((token) => words.includes(token)) || squash(name) === squashedQuery;
  });
}

function mediaMatches(media: AniMedia, squashedQuery: string): boolean {
  const titles = [media.title.english, media.title.romaji, media.title.native]
    .filter((title): title is string => Boolean(title))
    .map(squash);
  // Exact or leading-title matches only: "lookism" finds Lookism, but "sun"
  // must not pull in every series with a sun somewhere in its name.
  return titles.some((title) => title === squashedQuery || (squashedQuery.length >= 5 && title.startsWith(squashedQuery)));
}

const titleOf = (media: AniMediaLite | AniMedia | undefined | null) =>
  media?.title?.english || media?.title?.romaji || "AniList";

function characterImage(character: AniCharacter, fallbackColor: string, fromMedia?: string): WejiImage | null {
  const url = character.image?.large;
  if (!url || url.includes("/default.jpg")) return null;
  const series = fromMedia ?? titleOf(character.media?.nodes?.[0]);
  const name = character.name.full ?? "Character";
  return {
    id: `anilist:character:${character.id}`,
    source: "anime",
    thumb: url,
    full: url,
    download: url,
    raw: url,
    width: 230,
    height: 345,
    color: character.media?.nodes?.[0]?.coverImage?.color ?? fallbackColor,
    alt: `${name} — ${series}`,
    credit: series,
    creditUrl: character.siteUrl,
    sourceName: "AniList",
    sourceUrl: character.siteUrl,
  };
}

function mediaImages(media: AniMedia | AniMediaLite): WejiImage[] {
  const color = media.coverImage?.color ?? "#1b1826";
  const title = titleOf(media);
  const out: WejiImage[] = [];
  if (media.coverImage?.extraLarge) {
    out.push({
      id: `anilist:cover:${media.id}`,
      source: "anime",
      thumb: media.coverImage.extraLarge,
      full: media.coverImage.extraLarge,
      download: media.coverImage.extraLarge,
      raw: media.coverImage.extraLarge,
      width: 460,
      height: 654,
      color,
      alt: `${title} (${media.type === "ANIME" ? "anime" : "manga"})`,
      credit: title,
      creditUrl: media.siteUrl,
      sourceName: "AniList",
      sourceUrl: media.siteUrl,
    });
  }
  if (media.bannerImage) {
    out.push({
      id: `anilist:banner:${media.id}`,
      source: "anime",
      thumb: media.bannerImage,
      full: media.bannerImage,
      download: media.bannerImage,
      raw: media.bannerImage,
      width: 1900,
      height: 400,
      color,
      alt: title,
      credit: title,
      creditUrl: media.siteUrl,
      sourceName: "AniList",
      sourceUrl: media.siteUrl,
    });
  }
  return out;
}

const CHARACTER_FIELDS = `
  id
  name { full native alternative }
  image { large }
  siteUrl
  favourites
  media(perPage: 1, sort: POPULARITY_DESC) { nodes { id type siteUrl bannerImage title { romaji english } isAdult coverImage { extraLarge color } } }
`;

/** A series' own cast: the series is already known, and nesting it again makes AniList time out. */
const CAST_FIELDS = "id name { full native alternative } image { large } siteUrl favourites";

/**
 * Characters matching the name (in every likely spelling), then any series
 * whose title matches, with that series' main cast. Never throws.
 */
export async function searchAnime(query: string): Promise<WejiImage[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const variants = nameVariants(trimmed);
  const variableDefs = variants.map((_, i) => `$v${i}: String`).join(", ");
  const characterBlocks = variants
    .map((_, i) => `c${i}: Page(perPage: 6) { characters(search: $v${i}, sort: SEARCH_MATCH) { ${CHARACTER_FIELDS} } }`)
    .join("\n");

  const gql = `query (${variableDefs}) {
    ${characterBlocks}
    m: Page(perPage: 3) {
      media(search: $v0, isAdult: false, sort: SEARCH_MATCH) {
        id type isAdult siteUrl bannerImage popularity
        title { romaji english native }
        coverImage { extraLarge color }
        characters(perPage: 16, sort: [ROLE, FAVOURITES_DESC]) { nodes { ${CAST_FIELDS} } }
      }
    }
  }`;
  const variables = Object.fromEntries(variants.map((variant, i) => [`v${i}`, variant]));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql, variables }),
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data?: Record<string, { characters?: AniCharacter[]; media?: AniMedia[] }> };
    const data = json.data;
    if (!data) return [];

    const queryTokens = tokensOf(trimmed);
    const squashedQuery = squash(trimmed);
    const oneWord = queryTokens.length < 2;
    const seen = new Set<string>();
    const results: WejiImage[] = [];
    const push = (image: WejiImage | null) => {
      if (!image || seen.has(image.id) || isResultBlocked(image.alt)) return;
      seen.add(image.id);
      results.push(image);
    };

    // 1. Characters whose name matches, in any of the spellings tried.
    variants.forEach((_, i) => {
      for (const character of data[`c${i}`]?.characters ?? []) {
        if (character.media?.nodes?.some((media) => media.isAdult)) continue;
        if (oneWord && (character.favourites ?? 0) < MIN_CHARACTER_FAVOURITES) continue;
        if (characterMatches(character, queryTokens) || characterMatches(character, tokensOf(variants[i]))) {
          push(characterImage(character, "#1b1826"));
          // Then the series they come from, so one name finds their world too.
          const series = character.media?.nodes?.[0];
          if (series) mediaImages(series).forEach(push);
        }
      }
    });

    // 2. Series whose title matches, with their covers, banners and main cast.
    for (const media of data.m?.media ?? []) {
      if (media.isAdult || !mediaMatches(media, squashedQuery)) continue;
      if (oneWord && (media.popularity ?? 0) < MIN_MEDIA_POPULARITY) continue;
      mediaImages(media).forEach(push);
      const color = media.coverImage?.color ?? "#1b1826";
      for (const character of media.characters?.nodes ?? []) {
        push(characterImage(character, color, titleOf(media)));
      }
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** This season's most talked-about anime and manga covers, for the home room. Never throws. */
export async function trendingAnime(count = 24): Promise<WejiImage[]> {
  const gql = `query {
    Page(perPage: ${Math.min(count, 50)}) {
      media(sort: TRENDING_DESC, isAdult: false) {
        id type isAdult siteUrl bannerImage popularity
        title { romaji english native }
        coverImage { extraLarge color }
      }
    }
  }`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: gql }),
      signal: controller.signal,
      next: { revalidate: 21600 },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data?: { Page?: { media?: AniMedia[] } } };
    return (json.data?.Page?.media ?? [])
      .filter((media) => !media.isAdult)
      .map((media) => mediaImages(media)[0])
      .filter((image): image is WejiImage => Boolean(image) && !isResultBlocked(image.alt));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
