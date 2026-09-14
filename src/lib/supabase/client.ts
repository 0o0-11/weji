"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/**
 * The browser-side Supabase client, loaded on demand.
 *
 * Supabase adds roughly 75 kB to a bundle. Importing it at the top of the app
 * would put that on the landing page — the one page whose entire job is to load
 * instantly for someone who has never heard of WEJI and has no account. So it
 * is imported dynamically after hydration instead: browsing, search and the 3D
 * pages never pay for it, and it arrives well before anyone can reach a form.
 */
let clientPromise: Promise<SupabaseClient | null> | null = null;

export function loadSupabaseBrowserClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);

  if (!clientPromise) {
    clientPromise = import("@supabase/ssr")
      .then(({ createBrowserClient }) => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch(() => null);
  }

  return clientPromise;
}
