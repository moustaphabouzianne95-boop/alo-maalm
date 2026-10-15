/**
 * Helpers for reading `searchParams` in pages.
 *
 * Every value that reaches a Prisma query goes through one of these, so a
 * hand-edited URL can never inject an unexpected type (§9).
 */

export type SearchParams = Record<string, string | string[] | undefined>;

export function spString(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function spOptionalString(value: string | string[] | undefined): string | undefined {
  const v = spString(value);
  return v ? v : undefined;
}

export function spNumber(value: string | string[] | undefined): number | undefined {
  const v = spString(value);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function spBool(value: string | string[] | undefined): boolean {
  return ["1", "true", "on"].includes(spString(value).toLowerCase());
}

export function spPage(value: string | string[] | undefined): number {
  return Math.max(1, Math.floor(spNumber(value) ?? 1));
}

export function spEnum<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  const v = spString(value);
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Rebuilds the current URL with a new `page`, preserving every other filter. */
export function buildPageHref(base: string, params: SearchParams, page: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page") continue;
    if (typeof value === "string" && value) query.set(key, value);
  }
  query.set("page", String(page));
  return `${base}?${query.toString()}`;
}
