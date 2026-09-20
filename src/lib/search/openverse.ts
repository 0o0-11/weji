import type { WejiImage } from "./types";
import { isResultBlocked } from "./safety";

/**
 * Open-licence pictures from Openverse (Creative Commons and public domain,
 * mostly Flickr and Wikimedia Commons). No key is needed, but anonymous use is
 * limited to 20 results per request and 200 requests a day, shared by every
 * visitor — so results are cached for a day per search.
 *
 * Every picture carries its licence, and WEJI must show it: creator, licence
 * name and a link to the licence text.
 */

const ENDPOINT = "https://api.openverse.org/v1/images/";
const TIMEOUT_MS = 7000;
/** The most an anonymous request may ask for. */
const PAGE_SIZE = 20;

/**
 * Only these hosts let a browser draw their pictures into WEJI's 3D scene
 * (they send CORS headers). Anything else is shown through Openverse's own
 * thumbnail service, which does.
 */
const CORS_HOSTS = new Set(["live.staticflickr.com", "upload.wikimedia.org"]);

interface OpenverseImage {
  id: string;
  title: string | null;
  foreign_landing_url: string | null;
  url: string;
  creator: string | null;
  creator_url: string | null;
  license: string;
  license_version: string | null;
  license_url: string | null;
  source: string;
  mature: boolean;
  width: number | null;
  height: number | null;
  thumbnail: string;
  tags: { name: string }[] | null;
  unstable__sensitivity?: string[];
}

/** "by-sa" + "2.0" → "CC BY-SA 2.0"; public-domain marks read as themselves. */
function licenseLabel(license: string, version: string | null): string {
  if (license === "cc0") return "CC0";
  if (license === "pdm") return "Public Domain";
  return `CC ${license.toUpperCase()}${version ? ` ${version}` : ""}`;
}

const SOURCE_NAMES: Record<string, string> = {
  flickr: "Flickr",
  wikimedia: "Wikimedia Commons",
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function mapOpenverse(item: OpenverseImage): WejiImage {
  const full = CORS_HOSTS.has(hostOf(item.url)) ? item.url : item.thumbnail;
  const landing = item.foreign_landing_url ?? item.url;
  return {
    id: `openverse:${item.id}`,
    source: "openverse",
    thumb: item.thumbnail,
    full,
    download: full,
    raw: item.url,
    width: item.width ?? 1024,
    height: item.height ?? 768,
    color: "#1c1a24",
    alt: item.title ?? "",
    credit: item.creator ?? "Unknown creator",
    creditUrl: item.creator_url ?? landing,
    sourceName: SOURCE_NAMES[item.source] ?? "Openverse",
    sourceUrl: landing,
    license: licenseLabel(item.license, item.license_version),
    licenseUrl: item.license_url ?? undefined,
  };
}

const describe = (item: OpenverseImage) =>
  [item.title, ...(item.tags ?? []).map((tag) => tag.name)].filter(Boolean).join(" ");

/** One page of open-licence results. Never throws. */
export async function searchOpenverse(query: string, page = 1): Promise<WejiImage[]> {
  const url =
    `${ENDPOINT}?q=${encodeURIComponent(query)}&page=${page}&page_size=${PAGE_SIZE}` +
    `&mature=false&source=flickr,wikimedia`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { results?: OpenverseImage[] };
    return (data.results ?? [])
      .filter((item) => !item.mature && !(item.unstable__sensitivity?.length) && !isResultBlocked(describe(item)))
      .map(mapOpenverse);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
