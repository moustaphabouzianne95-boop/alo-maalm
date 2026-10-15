import type { LangCode } from "@/lib/constants/morocco";

export type { LangCode };

export const LOCALES: readonly LangCode[] = ["ar", "fr", "en"] as const;
export const DEFAULT_LOCALE: LangCode = "ar";
export const LOCALE_COOKIE = "alomaalem_locale";

export const LOCALE_LABELS: Record<LangCode, { label: string; native: string; dir: "rtl" | "ltr" }> = {
  ar: { label: "Arabic", native: "العربية", dir: "rtl" },
  fr: { label: "French", native: "Français", dir: "ltr" },
  en: { label: "English", native: "English", dir: "ltr" },
};

export function isLocale(value: unknown): value is LangCode {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function dirFor(locale: LangCode): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** `ar` → `ar-MA`, used by Intl formatters for natural Moroccan formatting. */
export const LOCALE_TAG: Record<LangCode, string> = {
  ar: "ar-MA",
  fr: "fr-MA",
  en: "en-GB",
};

/** Maps the Prisma `Locale` enum onto a UI language code. */
export function fromDbLocale(value: string | null | undefined): LangCode {
  const lower = String(value ?? "").toLowerCase();
  return isLocale(lower) ? lower : DEFAULT_LOCALE;
}
