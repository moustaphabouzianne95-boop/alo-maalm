import type { LangCode } from "./config";

/**
 * Picks the best available localisation of a trilingual database column.
 * Falls back to Arabic (the default market language) then to any non-empty
 * value, so a partially translated row never renders blank.
 */
export function pickLocalized(
  row: Record<string, unknown> | null | undefined,
  locale: LangCode,
  baseField = "name"
): string {
  if (!row) return "";
  const suffix = locale === "ar" ? "" : locale === "fr" ? "Fr" : "En";
  const candidates = [
    row[`${baseField}${suffix}`],
    row[baseField],
    row[`${baseField}Ar`],
    row[`${baseField}Fr`],
    row[`${baseField}En`],
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }
  return "";
}

export function pickLocalizedDescription(
  row: Record<string, unknown> | null | undefined,
  locale: LangCode
): string {
  return pickLocalized(row, locale, "description");
}
