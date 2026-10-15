import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type LangCode } from "./config";

/**
 * Locale resolution for server components.
 *
 * Priority: explicit `?lang=` (propagated by middleware into a header) →
 * locale cookie → Arabic default. Keeping the locale out of the URL preserves
 * the canonical routes required by the spec (`/services`, `/professionals/…`)
 * while still giving every page a deterministic `lang`/`dir`.
 */
export async function getLocale(): Promise<LangCode> {
  try {
    const headerLocale = (await headers()).get("x-locale");
    if (isLocale(headerLocale)) return headerLocale;
  } catch {
    /* headers() unavailable outside a request scope */
  }
  try {
    const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieLocale)) return cookieLocale;
  } catch {
    /* cookies() unavailable outside a request scope */
  }
  return DEFAULT_LOCALE;
}
