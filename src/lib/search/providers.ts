import type { WejiImage } from "./types";
import { filterSafe } from "./safety";

/**
 * Image providers. Every function here runs on the server only — API keys are
 * read from the environment and never reach the browser.
 *
 * Each provider fails soft: if a key is missing, a request times out, or a
 * provider has an outage, we return an empty list and the other provider still
 * fills the page. A search should never show an error screen.
 */

const TIMEOUT_MS = 8000;

async function fetchJson<T>(url: string, headers: Record<string, string>, revalidate: number): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      next: { revalidate },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function hasKeys(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY || process.env.PEXELS_API_KEY);
}

// ── Unsplash ──────────────────────────────────────────────────────────────

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  color: string | null;
  alt_description: string | null;
  description: string | null;
  urls: { raw: string; full: string; regular: string; small: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
  tags?: { title: string }[];
}

function mapUnsplash(p: UnsplashPhoto): WejiImage {
  return {
    id: `unsplash:${p.id}`,
    source: "unsplash",
    thumb: `${p.urls.raw}&w=600&q=75&fm=jpg&fit=max`,
    full: `${p.urls.raw}&w=1600&q=85&fm=jpg&fit=max`,
    download: `${p.urls.raw}&q=95&fm=jpg`,
    width: p.width,
    height: p.height,
    color: p.color ?? "#1a1a20",
    alt: p.alt_description ?? p.description ?? "",
    credit: p.user.name,
    creditUrl: p.links.html,
  };
}

const describeUnsplash = (p: UnsplashPhoto) =>
  [p.alt_description, p.description, ...(p.tags ?? []).map((t) => t.title)].filter(Boolean).join(" ");

export async function searchUnsplash(query: string, page: number, perPage: number): Promise<WejiImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const url =
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}` +
    `&page=${page}&per_page=${perPage}&content_filter=high`;
  const data = await fetchJson<{ results: UnsplashPhoto[] }>(
    url,
    { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    3600,
  );
  if (!data?.results) return [];
  return filterSafe(data.results, describeUnsplash).map(mapUnsplash);
}

export async function popularUnsplash(page: number, perPage: number): Promise<WejiImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const url = `https://api.unsplash.com/photos?order_by=popular&page=${page}&per_page=${perPage}`;
  const data = await fetchJson<UnsplashPhoto[]>(
    url,
    { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
    1800,
  );
  if (!Array.isArray(data)) return [];
  return filterSafe(data, describeUnsplash).map(mapUnsplash);
}

// ── Pexels ────────────────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  avg_color: string | null;
  alt: string | null;
  url: string;
  photographer: string;
  photographer_url: string;
  src: { original: string; large2x: string; large: string; medium: string; small: string };
}

function mapPexels(p: PexelsPhoto): WejiImage {
  return {
    id: `pexels:${p.id}`,
    source: "pexels",
    thumb: `${p.src.original}?auto=compress&cs=tinysrgb&w=600`,
    full: `${p.src.original}?auto=compress&cs=tinysrgb&w=1600`,
    download: p.src.original,
    width: p.width,
    height: p.height,
    color: p.avg_color ?? "#1a1a20",
    alt: p.alt ?? "",
    credit: p.photographer,
    creditUrl: p.photographer_url,
  };
}

const describePexels = (p: PexelsPhoto) => [p.alt, p.url.replace(/[-/]/g, " ")].filter(Boolean).join(" ");

export async function searchPexels(query: string, page: number, perPage: number): Promise<WejiImage[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
  const data = await fetchJson<{ photos: PexelsPhoto[] }>(url, { Authorization: key }, 3600);
  if (!data?.photos) return [];
  return filterSafe(data.photos, describePexels).map(mapPexels);
}

export async function curatedPexels(page: number, perPage: number): Promise<WejiImage[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const url = `https://api.pexels.com/v1/curated?page=${page}&per_page=${perPage}`;
  const data = await fetchJson<{ photos: PexelsPhoto[] }>(url, { Authorization: key }, 1800);
  if (!data?.photos) return [];
  return filterSafe(data.photos, describePexels).map(mapPexels);
}

// ── Demo mode ─────────────────────────────────────────────────────────────

/**
 * Keyless placeholder results, so WEJI is fully explorable before any API keys
 * exist. Deterministic per query+page, so the layout is stable across reloads.
 */
export function demoImages(query: string, page: number, count: number): WejiImage[] {
  const shapes: [number, number][] = [
    [800, 1200], [1200, 800], [900, 900], [800, 1400], [1400, 900], [1000, 1250],
  ];
  const palette = ["#2a1f14", "#14202a", "#1f2a14", "#2a1424", "#14262a", "#2a2414"];
  return Array.from({ length: count }, (_, i) => {
    const n = page * 1000 + i;
    const seed = `${query || "weji"}-${n}`;
    const [w, h] = shapes[(n + query.length) % shapes.length];
    return {
      id: `demo:${seed}`,
      source: "demo" as const,
      thumb: `https://picsum.photos/seed/${encodeURIComponent(seed)}/${Math.round(w / 2)}/${Math.round(h / 2)}`,
      full: `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`,
      download: `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w * 2}/${h * 2}`,
      width: w,
      height: h,
      color: palette[n % palette.length],
      alt: query ? `${query} — demo image` : "WEJI demo image",
      credit: "Demo mode",
      creditUrl: "https://picsum.photos",
    };
  });
}

// ── Merge ─────────────────────────────────────────────────────────────────

/**
 * Interleave the providers rather than concatenating them, so a page of results
 * doesn't read as "20 Unsplash photos, then 20 Pexels photos".
 */
export function interleave(...lists: WejiImage[][]): WejiImage[] {
  const out: WejiImage[] = [];
  const seen = new Set<string>();
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
  }
  return out;
}
