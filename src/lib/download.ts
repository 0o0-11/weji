import type { WejiImage } from "@/lib/search/types";

/**
 * Wallpaper downloads.
 *
 * Resizing is delegated to each provider's own image CDN, so WEJI never
 * processes an image itself — no image library, no CPU cost, no upload storage.
 */

export type WallpaperSize = "phone" | "desktop" | "original";

export const WALLPAPER_SIZES: { key: WallpaperSize; width: number; height: number }[] = [
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
export function buildSizedUrl(image: WejiImage, size: WallpaperSize): string | null {
  if (!isDownloadable(image)) return null;
  if (size === "original") return image.download;

  const spec = WALLPAPER_SIZES.find((candidate) => candidate.key === size);
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
export function buildFilename(image: WejiImage, size: WallpaperSize): string {
  const slug = (image.alt || "weji-wallpaper")
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "weji-wallpaper";
  return `weji-${slug}-${size}.jpg`;
}

/**
 * The URL the browser should hit to save the file.
 *
 * It goes through our own /api/download rather than straight to the CDN because
 * a cross-origin `<a download>` is ignored by browsers — the picture would open
 * in a new tab instead of saving, which is not what "Download" promises.
 */
export function buildDownloadHref(image: WejiImage, size: WallpaperSize): string | null {
  const src = buildSizedUrl(image, size);
  if (!src) return null;
  return `/api/download?src=${encodeURIComponent(src)}&name=${encodeURIComponent(buildFilename(image, size))}`;
}
