/**
 * Supabase configuration.
 *
 * WEJI is designed to run perfectly well *before* a Supabase project exists —
 * browsing, search and the 3D pages never touch it. Only accounts do. So every
 * entry point checks `isSupabaseConfigured` first and degrades to the on-device
 * library rather than crashing.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
