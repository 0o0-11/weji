import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Keeps the signed-in session alive.
 *
 * Supabase access tokens are short-lived. Without this, a user would appear
 * signed out after an hour even though their session is still valid — the
 * middleware refreshes the token and writes the new cookies back on every
 * request. It does not guard any routes: WEJI is deliberately open to browse,
 * and only the account pages care who you are.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // An unreachable Supabase must never take the whole site down.
  }

  return response;
}

export const config = {
  // Skip static assets and image files — they don't need a session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
