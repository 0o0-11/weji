import { XMLParser } from "fast-xml-parser";
import type { WejiImage } from "../search/types";
import { isResultBlocked } from "../search/safety";

/**
 * News pictures for the WEJI home page.
 *
 * Deliberately RSS rather than a news API: no key, no signup, no daily request
 * cap, no bill — and it gives us genuine Arabic *and* English outlets, which a
 * single API rarely does well. Every feed fails soft; one dead outlet must
 * never empty the home page.
 */

interface Feed {
  url: string;
  outlet: string;
  lang: "en" | "ar";
}

/**
 * Only feeds that actually ship pictures earn a place here — WEJI is a picture
 * app, and a text-only feed contributes nothing. Al Jazeera and DW publish no
 * images in RSS at all; Al Arabiya and Sky News Arabia refuse non-browser
 * clients; CNN attaches generic years-old stock photos rather than the
 * picture belonging to the story. Each entry below was checked for real,
 * current, story-specific image payloads.
 */
const FEEDS: Feed[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", outlet: "BBC News", lang: "en" },
  { url: "https://www.theguardian.com/world/rss", outlet: "The Guardian", lang: "en" },
  { url: "https://feeds.skynews.com/feeds/rss/world.xml", outlet: "Sky News", lang: "en" },
  { url: "https://feeds.bbci.co.uk/arabic/rss.xml", outlet: "بي بي سي", lang: "ar" },
  { url: "https://www.france24.com/ar/rss", outlet: "فرانس 24", lang: "ar" },
  { url: "https://arabic.rt.com/rss/", outlet: "RT عربي", lang: "ar" },
];

// Entity decoding is done by hand below rather than by the parser: the
// Guardian's feed contains more entities than fast-xml-parser's built-in
// expansion guard allows, and the parser aborts the whole document rather than
// the offending field. Decoding ourselves is both safe and unbounded.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: false,
});

type Loose = Record<string, unknown>;

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(input: string): string {
  return input.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (match, dec, hex, name) => {
    try {
      if (dec) return String.fromCodePoint(Number(dec));
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return NAMED_ENTITIES[String(name).toLowerCase()] ?? match;
    } catch {
      return match;
    }
  });
}

function text(v: unknown): string {
  if (typeof v === "string") return decodeEntities(v);
  if (v && typeof v === "object" && "#text" in (v as Loose)) {
    return decodeEntities(String((v as Loose)["#text"] ?? ""));
  }
  return "";
}

/**
 * Publishers serve thumbnails far smaller than a full-bleed picture grid needs.
 * Where a CDN encodes the width in the path, ask it for a bigger rendition.
 */
function upgradeImageUrl(url: string): string {
  // BBC ships 240px by default; ichef will render any size in the same slot.
  return decodeEntities(url).replace(
    /(ichef\.bbci\.co\.uk\/(?:ace\/(?:standard|ws)|news))\/\d{2,4}\//,
    "$1/976/",
  );
}

/** RSS has no standard image field, so try every convention outlets actually use. */
function extractImage(item: Loose): string | null {
  // CNN nests its pictures one level down inside <media:group>, so search the
  // item and any media:group children together.
  const containers: Loose[] = [item, ...asArray(item["media:group"] as Loose | Loose[])].filter(Boolean);

  // Outlets like the Guardian and CNN list the same picture at several widths.
  // Take the widest rather than whichever happens to come first.
  let best: { url: string; width: number } | null = null;
  for (const container of containers) {
    for (const key of ["media:content", "media:thumbnail"]) {
      for (const node of asArray(container[key] as Loose | Loose[])) {
        const url = node?.["@_url"];
        if (typeof url !== "string" || !url.startsWith("http")) continue;
        const type = String(node?.["@_medium"] ?? node?.["@_type"] ?? "");
        if (type && !type.startsWith("image")) continue;
        const width = Number(node?.["@_width"]) || 0;
        if (!best || width > best.width) best = { url, width };
      }
    }
  }
  if (best) return upgradeImageUrl(best.url);

  for (const node of asArray(item.enclosure as Loose | Loose[])) {
    const url = node?.["@_url"];
    const type = String(node?.["@_type"] ?? "");
    if (typeof url === "string" && (type.startsWith("image") || /\.(jpe?g|png|webp)/i.test(url))) {
      return upgradeImageUrl(url);
    }
  }

  const html = `${text(item["content:encoded"])} ${text(item.description)}`;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match?.[1]?.startsWith("http")) return upgradeImageUrl(match[1]);

  return null;
}

/** `text()` has already decoded entities, so only real tags remain to strip. */
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

async function fetchFeed(feed: Feed): Promise<WejiImage[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "WEJI/1.0 (+https://weji.app)" },
      next: { revalidate: 900 }, // 15 minutes
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const doc = parser.parse(xml) as Loose;
    const channel = (doc.rss as Loose)?.channel ?? doc.channel;
    const items = asArray((channel as Loose)?.item as Loose | Loose[]);

    const out: WejiImage[] = [];
    for (const item of items) {
      const image = extractImage(item);
      if (!image) continue; // WEJI is a picture app — a story with no picture is not a result

      const title = stripHtml(text(item.title));
      const summary = stripHtml(text(item.description));
      if (!title) continue;
      if (isResultBlocked(`${title} ${summary}`)) continue;

      const link = text(item.link) || text(item.guid);
      out.push({
        id: `news:${feed.outlet}:${link || image}`,
        source: "news",
        thumb: image,
        full: image,
        download: image,
        raw: image,
        // News images are overwhelmingly 16:9; the grid corrects itself once
        // the real image loads, this just prevents a layout jump before that.
        width: 1600,
        height: 900,
        color: "#16161d",
        alt: title,
        credit: feed.outlet,
        creditUrl: link,
        outlet: feed.outlet,
        articleUrl: link,
        publishedAt: text(item.pubDate) || undefined,
        lang: feed.lang,
      });
    }
    return out;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Newest first, de-duplicated by image, and interleaved across outlets so the
 * home page never shows ten consecutive stories from one source.
 */
export async function getNewsImages(lang?: "en" | "ar", limit = 40): Promise<WejiImage[]> {
  const selected = lang ? FEEDS.filter((f) => f.lang === lang) : FEEDS;
  const results = await Promise.all(selected.map(fetchFeed));

  const byOutlet = results.filter((list) => list.length > 0);
  const merged: WejiImage[] = [];
  const seen = new Set<string>();
  const max = Math.max(0, ...byOutlet.map((l) => l.length));

  for (let i = 0; i < max && merged.length < limit; i++) {
    for (const list of byOutlet) {
      const item = list[i];
      if (!item || seen.has(item.thumb)) continue;
      seen.add(item.thumb);
      merged.push(item);
      if (merged.length >= limit) break;
    }
  }
  return merged;
}
