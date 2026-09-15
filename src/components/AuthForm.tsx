"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "./Header";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Sign-in and sign-up share a form; only the copy and the call differ. */
export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { t } = useLocale();
  const { signIn, signUp, configured } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const isSignUp = mode === "signup";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        setConfirmSent(true);
        return;
      }
      router.push("/collections");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <Link href="/" className="mb-10 self-center" aria-label="WEJI home">
        <Wordmark />
      </Link>

      {/* Accounts need a Supabase project. Until one exists, say so plainly
          rather than showing a form that cannot possibly work. */}
      {!configured ? (
        <Panel title={t.authUnavailable} body={t.authUnavailableBody}>
          <Link
            href="/home"
            className="mt-5 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-bold text-ink transition hover:bg-gold-deep"
          >
            {t.backToBrowsing}
          </Link>
        </Panel>
      ) : confirmSent ? (
        <Panel title={t.checkInbox} body={t.checkInboxBody}>
          <p className="mt-4 text-sm text-gold" dir="ltr">
            {email}
          </p>
        </Panel>
      ) : (
        <>
          <h1 className="text-center text-2xl font-bold tracking-tight">
            {isSignUp ? t.signUpTitle : t.signInTitle}
          </h1>
          <p className="mt-2 text-center text-sm text-faint">{isSignUp ? t.signUpBody : t.signInBody}</p>

          {/* People reliably land on the wrong one of these two pages, so make
              the way across obvious before they fill anything in, not only in
              the small print underneath. */}
          <p className="mt-4 text-center text-xs text-muted">
            {isSignUp ? t.haveAccount : t.noAccount}{" "}
            <Link
              href={isSignUp ? "/login" : "/signup"}
              className="font-semibold text-gold underline decoration-gold/40 underline-offset-4"
            >
              {isSignUp ? t.signIn : t.signUp}
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field
              label={t.email}
              type="email"
              value={email}
              autoComplete="email"
              onChange={setEmail}
              required
            />
            <Field
              label={t.password}
              type="password"
              value={password}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              onChange={setPassword}
              hint={isSignUp ? t.passwordHint : undefined}
              minLength={6}
              required
            />

            {error && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-gold py-3 text-sm font-bold text-ink transition hover:bg-gold-deep disabled:opacity-50"
            >
              {busy ? t.working : isSignUp ? t.createAccountCta : t.signInCta}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-faint">
            {isSignUp ? t.haveAccount : t.noAccount}{" "}
            <Link
              href={isSignUp ? "/login" : "/signup"}
              className="font-semibold text-gold underline decoration-gold/40 underline-offset-4"
            >
              {isSignUp ? t.signIn : t.signUp}
            </Link>
          </p>
        </>
      )}

      {/* The unavailable panel already offers this, so don't repeat it there. */}
      {configured && (
        <Link href="/home" className="mt-10 text-center text-xs text-faint transition hover:text-muted">
          {t.backToBrowsing}
        </Link>
      )}
    </main>
  );
}

function Panel({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line-strong bg-panel p-7 text-center">
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  ...rest
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        dir="ltr"
        className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 text-sm text-fg outline-none transition placeholder:text-faint focus:border-gold/60"
      />
      {hint && <span className="mt-1 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}
