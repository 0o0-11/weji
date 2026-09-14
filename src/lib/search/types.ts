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
  width: number;
  height: number;
  /** Average colour — painted behind the image so the grid never flashes white. */
  color: string;
  alt: string;
  /** Photographer, outlet, or author. */
  credit: string;
  /** Link back to the source page — required by the Unsplash and Pexels licences. */
  creditUrl: string;
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
