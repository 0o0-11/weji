import type { WejiImage } from "@/lib/search/types";
import type { Collection, LibraryBackend } from "./types";

/**
 * The on-device library, used before anyone signs in.
 *
 * It lets a visitor try saving and liking immediately — which is what makes the
 * sign-up prompt feel worth acting on, rather than a wall in front of an app
 * they haven't used yet. Everything here is lifted into the user's real account
 * the first time they sign in (see migrateLocalToRemote).
 */

const KEY_COLLECTIONS = "weji.collections";
const KEY_ITEMS = "weji.items";
const KEY_LIKES = "weji.likes";
const KEY_TOPICS = "weji.topics";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Private browsing, disabled storage, or corrupt JSON.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Out of quota or storage blocked — the save simply doesn't persist.
  }
}

const itemsKey = (collectionId: string) => `${KEY_ITEMS}.${collectionId}`;

function ensureSeed(): Collection[] {
  const existing = read<Collection[]>(KEY_COLLECTIONS, []);
  if (existing.length > 0) return existing;
  const seeded: Collection[] = [
    { id: "default", name: "My picks", isDefault: true, createdAt: new Date().toISOString() },
  ];
  write(KEY_COLLECTIONS, seeded);
  return seeded;
}

export const localBackend: LibraryBackend = {
  async listCollections() {
    return ensureSeed().map((collection) => {
      const items = read<WejiImage[]>(itemsKey(collection.id), []);
      return { ...collection, count: items.length, cover: items[0]?.thumb ?? null };
    });
  },

  async createCollection(name) {
    const collections = ensureSeed();
    const collection: Collection = {
      id: `local-${Date.now().toString(36)}`,
      name: name.trim().slice(0, 60),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    write(KEY_COLLECTIONS, [...collections, collection]);
    return collection;
  },

  async deleteCollection(id) {
    write(
      KEY_COLLECTIONS,
      ensureSeed().filter((collection) => collection.id !== id),
    );
    try {
      window.localStorage.removeItem(itemsKey(id));
    } catch {
      // Nothing to clean up.
    }
  },

  async listItems(collectionId) {
    return read<WejiImage[]>(itemsKey(collectionId), []);
  },

  async saveItem(collectionId, image) {
    const items = read<WejiImage[]>(itemsKey(collectionId), []);
    if (items.some((item) => item.id === image.id)) return;
    write(itemsKey(collectionId), [image, ...items]);
  },

  async removeItem(collectionId, imageId) {
    const items = read<WejiImage[]>(itemsKey(collectionId), []);
    write(
      itemsKey(collectionId),
      items.filter((item) => item.id !== imageId),
    );
  },

  async listLikes() {
    return read<WejiImage[]>(KEY_LIKES, []);
  },

  async setLike(image, liked) {
    const likes = read<WejiImage[]>(KEY_LIKES, []);
    const without = likes.filter((item) => item.id !== image.id);
    write(KEY_LIKES, liked ? [image, ...without] : without);
  },

  async listTopics() {
    return read<string[]>(KEY_TOPICS, []);
  },

  async setTopic(topic, followed) {
    const topics = read<string[]>(KEY_TOPICS, []);
    const without = topics.filter((item) => item !== topic);
    write(KEY_TOPICS, followed ? [...without, topic] : without);
  },

  async snapshot() {
    const collections = ensureSeed();
    const savedIds = new Set<string>();
    for (const collection of collections) {
      for (const item of read<WejiImage[]>(itemsKey(collection.id), [])) {
        savedIds.add(item.id);
      }
    }
    return {
      likedIds: read<WejiImage[]>(KEY_LIKES, []).map((item) => item.id),
      savedIds: [...savedIds],
      topics: read<string[]>(KEY_TOPICS, []),
    };
  },
};

/** True when there is anything worth lifting into a new account. */
export async function localHasContent(): Promise<boolean> {
  const { likedIds, savedIds, topics } = await localBackend.snapshot();
  return likedIds.length > 0 || savedIds.length > 0 || topics.length > 0;
}

/**
 * Moves whatever the visitor saved before signing up into their real account,
 * then clears the device copy so nothing is duplicated or left behind.
 */
export async function migrateLocalToRemote(remote: LibraryBackend): Promise<void> {
  const collections = await localBackend.listCollections();
  const remoteCollections = await remote.listCollections();

  for (const collection of collections) {
    const items = await localBackend.listItems(collection.id);
    if (items.length === 0) continue;

    // Reuse a remote collection of the same name where one exists, so a signed-
    // up user doesn't end up with two boards called "My picks".
    const match =
      remoteCollections.find((candidate) => candidate.name === collection.name) ??
      (collection.isDefault ? remoteCollections.find((candidate) => candidate.isDefault) : undefined);

    const target = match ?? (await remote.createCollection(collection.name));
    for (const item of items.reverse()) {
      await remote.saveItem(target.id, item);
    }
  }

  for (const image of (await localBackend.listLikes()).reverse()) {
    await remote.setLike(image, true);
  }

  for (const topic of await localBackend.listTopics()) {
    await remote.setTopic(topic, true);
  }

  try {
    for (const collection of collections) {
      window.localStorage.removeItem(itemsKey(collection.id));
    }
    window.localStorage.removeItem(KEY_COLLECTIONS);
    window.localStorage.removeItem(KEY_LIKES);
    window.localStorage.removeItem(KEY_TOPICS);
  } catch {
    // If clearing fails the data is already safely in the account.
  }
}
