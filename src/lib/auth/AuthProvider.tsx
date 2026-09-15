"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { loadSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface AuthResult {
  error?: string;
  /** Supabase sent a confirmation email; the user isn't signed in yet. */
  needsConfirmation?: boolean;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  /** False until a Supabase project is set up — accounts are unavailable. */
  configured: boolean;
  /** Shared client, so the library layer doesn't load a second copy. */
  client: SupabaseClient | null;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Turns Supabase's error text into something a normal person can act on. */
function friendlyError(message: string): string {
  const text = message.toLowerCase();
  // Supabase returns "invalid login credentials" both for a genuinely wrong
  // password and for an account that exists but hasn't confirmed its email.
  // Saying only "wrong password" sends people hunting for a mistake they
  // didn't make, so name both causes.
  if (text.includes("invalid login credentials")) {
    return "That email and password don't match — or the account hasn't been confirmed yet. Check your inbox for the confirmation link.";
  }
  if (text.includes("already registered")) return "That email already has an account. Try signing in.";
  if (text.includes("password should be")) return "Please use a password of at least 6 characters.";
  if (text.includes("email not confirmed")) return "Please confirm your email first — check your inbox.";
  if (text.includes("rate limit") || text.includes("too many")) return "Too many attempts. Please wait a minute.";
  if (text.includes("unable to validate email")) return "That doesn't look like a valid email address.";
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const supabase = await loadSupabaseBrowserClient();
      if (!active) return;

      if (!supabase) {
        setLoading(false);
        return;
      }
      setClient(supabase);

      try {
        const { data } = await supabase.auth.getSession();
        if (active) setUser(data.session?.user ?? null);
      } catch {
        // Treated as signed out.
      } finally {
        if (active) setLoading(false);
      }

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      unsubscribe = () => listener.subscription.unsubscribe();

      // The component may have unmounted while the client was loading.
      if (!active) unsubscribe();
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: isSupabaseConfigured,
      client,

      async signUp(email, password) {
        const supabase = await loadSupabaseBrowserClient();
        if (!supabase) return { error: "Accounts aren't set up yet." };

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) return { error: friendlyError(error.message) };

        // With email confirmation on (the Supabase default) there is a user but
        // no session until they click the link in their inbox.
        return { needsConfirmation: !data.session };
      },

      async signIn(email, password) {
        const supabase = await loadSupabaseBrowserClient();
        if (!supabase) return { error: "Accounts aren't set up yet." };

        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        return error ? { error: friendlyError(error.message) } : {};
      },

      async signOut() {
        const supabase = await loadSupabaseBrowserClient();
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [user, loading, client],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
