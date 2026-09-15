import type { WejiImage } from "@/lib/search/types";

/**
 * Downloading a photo at a size that suits the viewer's screen.
 *
 * Deliberately *not* framed as wallpapers. Unsplash and Pexels both prohibit
 * "wallpaper applications" by name in their API terms, and WEJI is a bilingual
 * search engine that happens to offer a convenient size — the distinction is
 * the difference between being approved and being cut off.
 *
 * Resizing is delegated to each provider's own image CDN, so WEJI never
 * processes an image itself — no image library, no CPU cost, no upload storage.
 */

export type DownloadSize = "phone" | "desktop" | "original";

export const DOWNLOAD_SIZES: { key: DownloadSize; width: number; height: number }[] = [
  { key: "phone", width: 1290, height: 2796 },
  { key: "desktop", width: 2560, height: 1440 },
  { key: "original", width: 0, height: 0 },
];

/**
 * News pictures are *not* downloadable. They belong to the publisher rather
 * than being openly licensed like Unsplash and Pexels photos, so WEJI links to
 * the story instead. This also keeps the download proxy's allow-list closed to
 * three known image CDNs rather than the whole internet.
 */
export function isDownloadable(image: WejiImage): boolean {
  return image.source === "unsplash" || image.source === "pexels" || image.source === "demo";
}

/** The provider URL that renders this picture at the requested size. */
export function buildSizedUrl(image: WejiImage, size: DownloadSize): string | null {
  if (!isDownloadable(image)) return null;
  if (size === "original") return image.download;

  const spec = DOWNLOAD_SIZES.find((candidate) => candidate.key === size);
  if (!spec) return null;
  const { width, height } = spec;

  switch (image.source) {
    case "unsplash":
      return `${image.raw}${image.raw.includes("?") ? "&" : "?"}w=${width}&h=${height}&fit=crop&crop=entropy&q=90&fm=jpg`;
    case "pexels":
      return `${image.raw}?auto=compress&cs=tinysrgb&fit=crop&w=${width}&h=${height}`;
    case "demo":
      return `${image.raw}/${width}/${height}`;
    default:
      return null;
  }
}

/** A tidy, safe filename for the saved file. */
export function buildFilename(image: WejiImage, size: DownloadSize): string {
  const slug = (image.alt || "weji-photo")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "weji-photo";
  return `weji-${slug}-${size}.jpg`;
}

/**
 * The URL the browser should hit to save the file.
 *
 * It goes through our own /api/download rather than straight to the CDN because
 * a cross-origin `<a download>` is ignored by browsers — the picture would open
 * in a new tab instead of saving, which is not what "Download" promises.
 */
export function buildDownloadHref(image: WejiImage, size: DownloadSize): string | null {
  const src = buildSizedUrl(image, size);
  if (!src) return null;

  const params = new URLSearchParams({ src, name: buildFilename(image, size) });
  // Carried through so the server can register the download with Unsplash,
  // which is a condition of their API terms.
  if (image.downloadLocation) params.set("track", image.downloadLocation);

  return `/api/download?${params.toString()}`;
}
