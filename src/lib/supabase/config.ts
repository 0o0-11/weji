/**
 * Supabase configuration.
 *
 * The project URL and anon key are public by design: they ship inside every
 * page a visitor loads, and what protects user data is the Row Level Security
 * in supabase/schema.sql, not the secrecy of this key. (The service_role key is
 * the secret one, and it never appears anywhere in this codebase.)
 *
 * So the real values are kept here as a fallback. Environment variables still
 * win when they are usable, but a mangled value, such as the masked
 * "eyJhbGci••••" that Vercel's hidden-value field can end up saving, is
 * rejected instead of shipped. A bullet character in a request header makes
 * the browser refuse every sign-in with "String contains non ISO-8859-1 code
 * point", which is exactly what reached production once.
 */
const FALLBACK_URL = "https://evitjskjqflqbafdbapn.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2aXRqc2tqcWZscWJhZmRiYXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NjM1MTYsImV4cCI6MjEwNTAzOTUxNn0.NbcXAqZSRTBRHnuWwZ8MiovqHXZa0tC56arhyQaa1to";

/** Only printable ASCII can travel in an HTTP header. */
const isHeaderSafe = (value: string) => value.length > 20 && /^[\x21-\x7e]+$/.test(value);

const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

export const SUPABASE_URL = envUrl.startsWith("https://") && isHeaderSafe(envUrl) ? envUrl : FALLBACK_URL;
export const SUPABASE_ANON_KEY = isHeaderSafe(envKey) ? envKey : FALLBACK_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
