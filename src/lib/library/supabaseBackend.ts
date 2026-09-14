import type { SupabaseClient } from "@supabase/supabase-js";
import type { WejiImage } from "@/lib/search/types";
import type { Collection, LibraryBackend } from "./types";

/**
 * The Supabase-backed library used once a user is signed in.
 *
 * Row Level Security in schema.sql means the database itself refuses to return
 * another user's rows, so none of these queries filter by user id defensively —
 * they can't reach anyone else's data even if asked to.
 */

interface CollectionRow {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

interface ItemRow {
  image: WejiImage;
}

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

export function createSupabaseBackend(supabase: SupabaseClient, userId: string): LibraryBackend {
  return {
    async listCollections() {
      const { data, error } = await supabase
        .from("collections")
        .select("id, name, is_default, created_at, collection_items(image)")
        .order("created_at", { ascending: true });
      if (error || !data) return [];

      return (data as (CollectionRow & { collection_items: ItemRow[] })[]).map((row) => ({
        ...toCollection(row),
        count: row.collection_items?.length ?? 0,
        cover: row.collection_items?.[0]?.image?.thumb ?? null,
      }));
    },

    async createCollection(name) {
      const { data, error } = await supabase
        .from("collections")
        .insert({ user_id: userId, name: name.trim().slice(0, 60) })
        .select("id, name, is_default, created_at")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not create that collection.");
      return toCollection(data as CollectionRow);
    },

    async deleteCollection(id) {
      // collection_items rows are removed by the ON DELETE CASCADE in the schema.
      await supabase.from("collections").delete().eq("id", id);
    },

    async listItems(collectionId) {
      const { data, error } = await supabase
        .from("collection_items")
        .select("image")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });
      if (error || !data) return [];
      return (data as ItemRow[]).map((row) => row.image);
    },

    async saveItem(collectionId, image) {
      // upsert, so saving the same picture twice is harmless rather than an error.
      await supabase.from("collection_items").upsert(
        {
          collection_id: collectionId,
          user_id: userId,
          image_id: image.id,
          image,
        },
        { onConflict: "collection_id,image_id" },
      );
    },

    async removeItem(collectionId, imageId) {
      await supabase
        .from("collection_items")
        .delete()
        .eq("collection_id", collectionId)
        .eq("image_id", imageId);
    },

    async listLikes() {
      const { data, error } = await supabase
        .from("likes")
        .select("image")
        .order("created_at", { ascending: false });
      if (error || !data) return [];
      return (data as ItemRow[]).map((row) => row.image);
    },

    async setLike(image, liked) {
      if (liked) {
        await supabase
          .from("likes")
          .upsert({ user_id: userId, image_id: image.id, image }, { onConflict: "user_id,image_id" });
      } else {
        await supabase.from("likes").delete().eq("image_id", image.id);
      }
    },

    async snapshot() {
      const [likes, items] = await Promise.all([
        supabase.from("likes").select("image_id"),
        supabase.from("collection_items").select("image_id"),
      ]);
      return {
        likedIds: ((likes.data as { image_id: string }[] | null) ?? []).map((row) => row.image_id),
        savedIds: ((items.data as { image_id: string }[] | null) ?? []).map((row) => row.image_id),
      };
    },
  };
}
