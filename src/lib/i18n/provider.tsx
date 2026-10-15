"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dictionaries } from "./dictionaries";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_LABELS, LOCALE_TAG, dirFor, isLocale, type LangCode } from "./config";
import { translate, type Interpolation } from "./translate";

interface I18nValue {
  locale: LangCode;
  dir: "rtl" | "ltr";
  t: (key: string, vars?: Interpolation) => string;
  setLocale: (next: LangCode, opts?: { reload?: boolean }) => void;
  /** Intl-bound formatters for the active locale. */
  formatDate: (value: Date | string | number | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string | number | null | undefined) => string;
  formatTime: (value: Date | string | number | null | undefined) => string;
  formatRelative: (value: Date | string | number | null | undefined) => string;
  formatNumber: (value: number, digits?: number) => string;
  formatMoney: (value: number | null | undefined) => string;
  formatMoneyRange: (min: number | null | undefined, max: number | null | undefined) => string;
  formatPercent: (value: number, digits?: number) => string;
  availableLocales: typeof LOCALE_LABELS;
}

const I18nContext = createContext<I18nValue | null>(null);

const AR_CURRENCY = "د.م.";

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function I18nProvider({ locale: initialLocale, children }: { locale?: LangCode; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [locale, setLocaleState] = useState<LangCode>(isLocale(initialLocale) ? initialLocale : DEFAULT_LOCALE);

  // The `?lang=` query (set by the language switcher) wins over the cookie so a
  // shared link opens in the sender's language.
  useEffect(() => {
    const fromQuery = searchParams?.get("lang");
    if (isLocale(fromQuery) && fromQuery !== locale) setLocaleState(fromQuery);
  }, [searchParams, locale]);

  useEffect(() => {
    const dir = dirFor(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.dataset.locale = locale;
  }, [locale]);

  const setLocale = useCallback(
    (next: LangCode, opts?: { reload?: boolean }) => {
      if (!isLocale(next)) return;
      setLocaleState(next);
      const maxAge = 60 * 60 * 24 * 365;
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${maxAge};samesite=lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = dirFor(next);
      if (opts?.reload !== false) {
        // Re-fetch the current RSC payload so server-rendered copy updates too.
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("lang", next);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        router.refresh();
      }
    },
    [pathname, router, searchParams]
  );

  const tag = LOCALE_TAG[locale];

  const value = useMemo<I18nValue>(() => {
    const numberFmt = new Intl.NumberFormat(tag);
    const moneyFmt = (value: number | null | undefined) => {
      const v = value ?? 0;
      const digits = new Intl.NumberFormat(tag, { maximumFractionDigits: v % 1 === 0 ? 0 : 2 }).format(v);
      return locale === "ar" ? `${digits} ${AR_CURRENCY}` : `${digits} MAD`;
    };
    return {
      locale,
      dir: dirFor(locale),
      t: (key, vars) => translate(locale, key, vars),
      setLocale,
      formatDate: (v, opts) => {
        const date = toDate(v);
        if (!date) return "—";
        return new Intl.DateTimeFormat(tag, opts ?? { day: "numeric", month: "short", year: "numeric" }).format(date);
      },
      formatDateTime: (v) => {
        const date = toDate(v);
        if (!date) return "—";
        return new Intl.DateTimeFormat(tag, {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      },
      formatTime: (v) => {
        const date = toDate(v);
        if (!date) return "—";
        return new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }).format(date);
      },
      formatRelative: (v) => {
        const date = toDate(v);
        if (!date) return "—";
        const diffMs = date.getTime() - Date.now();
        const absMin = Math.round(Math.abs(diffMs) / 60000);
        if (absMin < 1) return translate(locale, "time.justNow");
        const future = diffMs > 0;
        if (absMin < 60) {
          return translate(locale, future ? "time.inMinutes" : "time.minutesAgo", { count: absMin });
        }
        const absHours = Math.round(absMin / 60);
        if (absHours < 24) {
          return translate(locale, future ? "time.inHours" : "time.hoursAgo", { count: absHours });
        }
        const absDays = Math.round(absHours / 24);
        if (absDays < 30) {
          return translate(locale, future ? "time.inDays" : "time.daysAgo", { count: absDays });
        }
        return new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric" }).format(date);
      },
      formatNumber: (v, digits = 0) =>
        new Intl.NumberFormat(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v),
      formatMoney: moneyFmt,
      formatMoneyRange: (min, max) => {
        const lo = Number(min ?? 0);
        if (max == null || Number(max) <= lo) return moneyFmt(lo);
        return `${moneyFmt(lo)} – ${moneyFmt(Number(max))}`;
      },
      formatPercent: (v, digits = 0) => `${numberFmt.format(Number((v * 100).toFixed(digits)))}%`,
      availableLocales: LOCALE_LABELS,
    };
  }, [locale, setLocale, tag]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Renders outside the provider (e.g. a stray client island): fall back to
    // Arabic rather than crashing the page.
    return {
      locale: DEFAULT_LOCALE,
      dir: "rtl",
      t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
      setLocale: () => {},
      formatDate: (v) => (v ? String(v) : "—"),
      formatDateTime: (v) => (v ? String(v) : "—"),
      formatTime: (v) => (v ? String(v) : "—"),
      formatRelative: (v) => (v ? String(v) : "—"),
      formatNumber: (v) => String(v),
      formatMoney: (v) => `${v ?? 0} ${AR_CURRENCY}`,
      formatMoneyRange: (a, b) => `${a ?? 0} – ${b ?? 0} ${AR_CURRENCY}`,
      formatPercent: (v) => `${Math.round(v * 100)}%`,
      availableLocales: LOCALE_LABELS,
    };
  }
  return ctx;
}

/** Shorthand for components that only need the translation function. */
export function useT() {
  return useI18n().t;
}

export { dictionaries };
