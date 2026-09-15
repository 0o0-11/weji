import type { WejiImage } from "@/lib/search/types";

export interface Collection {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  /** Number of pictures, when the backend can supply it cheaply. */
  count?: number;
  /** Thumbnail of the most recent picture, for the collections grid. */
  cover?: string | null;
}

/**
 * Everything the app needs from a store of saved pictures.
 *
 * There are two implementations: one backed by the browser (used before a user
 * signs in) and one backed by Supabase. Keeping them behind one interface means
 * every button in the UI is written once and works in both cases.
 */
export interface LibraryBackend {
  listCollections(): Promise<Collection[]>;
  createCollection(name: string): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;
  listItems(collectionId: string): Promise<WejiImage[]>;
  saveItem(collectionId: string, image: WejiImage): Promise<void>;
  removeItem(collectionId: string, imageId: string): Promise<void>;
  listLikes(): Promise<WejiImage[]>;
  setLike(image: WejiImage, liked: boolean): Promise<void>;

  /**
   * Followed topics drive the personalised home feed. Stored as the English
   * search term, never the translated label, so a reader who switches language
   * keeps the same follows.
   */
  listTopics(): Promise<string[]>;
  setTopic(topic: string, followed: boolean): Promise<void>;

  /** Ids only — loaded once so every heart and save badge renders instantly. */
  snapshot(): Promise<{ likedIds: string[]; savedIds: string[]; topics: string[] }>;
}
