import { LOCALE_TAG, type LangCode } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";

/**
 * Formatters for server components.
 *
 * The client provider (`useI18n`) cannot be used above the fold of an RSC, so
 * the same Intl rules live here. Keeping them in one module means the server
 * render and the hydrated client render produce identical strings.
 */

export function formatDateServer(
  value: Date | string | number | null | undefined,
  locale: LangCode,
  opts?: Intl.DateTimeFormatOptions
): string {
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(
    LOCALE_TAG[locale],
    opts ?? { day: "numeric", month: "short", year: "numeric" }
  ).format(date);
}

export function formatNumberServer(value: number, locale: LangCode, digits = 0): string {
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatRatingServer(value: number, locale: LangCode): string {
  return formatNumberServer(Number(value) || 0, locale, 1);
}

/** `90` → "1 ساعة و30 دقيقة" / "1 h 30 min" / "1 h 30 min". */
export function formatDurationServer(minutes: number | null | undefined, locale: LangCode): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total === 0) return "—";
  if (total < 60) return translate(locale, "common.duration.minutes", { count: total });
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (rest === 0) return translate(locale, "common.duration.hours", { count: hours });
  return translate(locale, "common.duration.hoursMinutes", { hours, minutes: rest });
}

export function formatResponseTimeServer(minutes: number | null | undefined, locale: LangCode): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total <= 0) return "—";
  return translate(locale, "common.responseTime", { value: formatDurationServer(total, locale) });
}
