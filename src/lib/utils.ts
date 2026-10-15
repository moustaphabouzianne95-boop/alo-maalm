import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-aware className combiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Absolute URL builder that respects the configured public app URL. */
export function absoluteUrl(path = "/", base?: string) {
  const root = (base ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!path) return root;
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Deterministic slug from any string (Arabic is transliterated by callers). */
export function slugify(input: string, fallback = "item"): string {
  const slug = input
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

/** Unique slug suffix so two "plombier-casablanca" services don't collide. */
export function withSlugSuffix(slug: string, seed: string): string {
  const hash = Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  return `${slug}-${hash.toString(36).slice(0, 5)}`;
}

export function truncate(value: string, max = 120): string {
  if (!value) return "";
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** `BK-4F7C2A` — short, human-readable, collision-checked against the DB. */
export function makeReference(prefix: string, entropy = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 confusion
  const bytes = new Uint8Array(entropy);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
  return `${prefix}-${body}`;
}

export function initialsOf(fullName?: string | null): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + second).toUpperCase() || first.toUpperCase();
}

/** Stable hue from a string — used for avatar backgrounds without images. */
export function hueFromString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 360;
  return h;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

export function average(values: number[]): number {
  if (!values.length) return 0;
  return sum(values) / values.length;
}

export function percentage(part: number, total: number, digits = 0): number {
  if (!total) return 0;
  const raw = (part / total) * 100;
  const f = 10 ** digits;
  return Math.round(raw * f) / f;
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function uniqueBy<T, K>(items: T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Removes `undefined` values so Prisma does not treat them as explicit nulls
 * during partial updates.
 */
export function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Normalises a phone number to Moroccan E.164 (+212…). */
export function normalizeMoroccanPhone(input: string): string | null {
  // Keep digits and a single leading `+`, then strip every country-code spelling
  // Moroccans actually type: `+212`, `00212`, `212`.
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("00212")) digits = digits.slice(5);
  else if (digits.startsWith("212")) digits = digits.slice(3);
  // The national trunk prefix: `0612345678` and `612345678` are the same number.
  if (digits.startsWith("0")) digits = digits.slice(1);
  // Nine significant digits, starting 5/6/7 (mobile and fixed ranges).
  if (digits.length !== 9 || !/^[5-7]/.test(digits)) return null;
  return `+212${digits}`;
}

/** Human-friendly mask for display: `06 12 34 56 78`. */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("212")) {
    const n = digits.slice(3);
    return `0${n.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
  }
  return phone;
}

/** Mask everything but the last two digits — trust & safety §51. */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-2);
  return `•• •• •• ${tail}`;
}

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function pluralizeAr(count: number, one: string, two: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count === 2) return two;
  if (count % 100 >= 3 && count % 100 <= 10) return few;
  return many;
}
