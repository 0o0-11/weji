/** One picture, normalised across every source WEJI pulls from. */
export interface WejiImage {
  /** Stable id, namespaced by source so ids can never collide. */
  id: string;
  source: "unsplash" | "pexels" | "news" | "demo";
  /** Grid thumbnail. */
  thumb: string;
  /** Full-bleed version for the 3D viewer. */
  full: string;
  /** Highest available original, used for downloads. */
  download: string;
  /**
   * The provider's un-sized base URL. Wallpaper downloads are built from this
   * by asking the provider's own CDN to render an exact size, so WEJI never has
   * to resize an image itself.
   */
  raw: string;
  width: number;
  height: number;
  /** Average colour — painted behind the image so the grid never flashes white. */
  color: string;
  alt: string;
  /** Photographer, outlet, or author. */
  credit: string;
  /**
   * Link to the photographer's own profile. Unsplash and Pexels both *require*
   * this, not merely the name in text.
   */
  creditUrl: string;
  /** The provider we must also name and link — "Unsplash", "Pexels", or an outlet. */
  sourceName: string;
  /** The picture's page on the provider's own site. */
  sourceUrl: string;
  /**
   * Unsplash requires a ping to this URL whenever a user downloads a picture,
   * so photographers' download counts stay accurate. Not a download URL itself.
   */
  downloadLocation?: string;
  /** Present only on news pictures. */
  publishedAt?: string;
  outlet?: string;
  articleUrl?: string;
  /** Language of the outlet, so the home page can match the reader. */
  lang?: "en" | "ar";
}

export interface SearchResponse {
  images: WejiImage[];
  /** What we actually searched for, after Arabic translation. */
  query: string;
  /** What the user typed. */
  originalQuery: string;
  translated: boolean;
  page: number;
  /** Demo mode = no API keys configured yet. */
  demo: boolean;
}
