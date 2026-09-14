"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STRINGS, type Locale, type Strings } from "./dictionary";

interface LocaleContextValue {
  locale: Locale;
  t: Strings;
  dir: "rtl" | "ltr";
  setLocale: (next: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const STORAGE_KEY = "weji.locale";

/**
 * Language is auto-detected from the browser on a first visit and remembered
 * after that. The very first paint is handled by an inline script in the root
 * layout so there is no flash of the wrong language or direction.
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let initial: Locale = "en";
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "ar" || stored === "en") {
        initial = stored;
      } else if (navigator.language?.toLowerCase().startsWith("ar")) {
        initial = "ar";
      }
    } catch {
      // Private browsing can throw on localStorage; the default is fine.
    }
    setLocaleState(initial);
  }, []);

  useEffect(() => {
    const dir = STRINGS[locale].dir;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore — the choice simply won't persist.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      t: STRINGS[locale] as unknown as Strings,
      dir: STRINGS[locale].dir as "rtl" | "ltr",
      setLocale,
      toggleLocale: () => setLocale(locale === "ar" ? "en" : "ar"),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}

/**
 * Runs before first paint so `dir` and `lang` are already correct when the page
 * renders. Without this, an Arabic user sees a left-to-right flash.
 */
export const LOCALE_BOOTSTRAP_SCRIPT = `
(function(){try{
var s=localStorage.getItem('${STORAGE_KEY}');
var l=(s==='ar'||s==='en')?s:((navigator.language||'en').toLowerCase().indexOf('ar')===0?'ar':'en');
document.documentElement.lang=l;
document.documentElement.dir=(l==='ar')?'rtl':'ltr';
}catch(e){}})();
`;
