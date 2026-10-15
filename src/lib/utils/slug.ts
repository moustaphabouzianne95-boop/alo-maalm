/**
 * Slug utilities.
 *
 * Arabic professional names must produce clean Latin URLs for SEO
 * (`/professionals/mohamed-alaoui`), so we transliterate before slugifying.
 * Database/API field names are never translated — only public URL segments.
 */

const ARABIC_MAP: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "aa", ٱ: "a",
  ب: "b", ة: "a", ت: "t", ث: "th",
  ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z",
  س: "s", ش: "sh", ص: "s", ض: "d",
  ط: "t", ظ: "z", ع: "a", غ: "gh",
  ف: "f", ق: "q", ك: "k", ل: "l",
  م: "m", ن: "n", ه: "h", و: "w",
  ي: "y", ى: "a", ء: "", ؤ: "o", ئ: "e",
  "ٰ": "a", "ّ": "", "َ": "a", "ُ": "u", "ِ": "i", "ْ": "", "ً": "an", "ٌ": "un", "ٍ": "in",
};

const FRENCH_ACCENTS: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", å: "a", æ: "ae",
  ç: "c", è: "e", é: "e", ê: "e", ë: "e",
  ì: "i", î: "i", ï: "i", ñ: "n", ò: "o", ô: "o", ö: "o",
  ù: "u", û: "u", ü: "u", ÿ: "y",
};

export function transliterateArabic(input: string): string {
  return Array.from(input)
    .map((ch) => ARABIC_MAP[ch] ?? FRENCH_ACCENTS[ch.toLowerCase()] ?? ch)
    .join("");
}

export function slugify(input: string, fallback = "item"): string {
  const slug = transliterateArabic(String(input))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 70)
    .replace(/-+$/, "");
  return slug || fallback;
}

/** Appends a short deterministic suffix derived from `seed`. */
export function uniqueSlug(base: string, seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const suffix = (hash >>> 0).toString(36).slice(0, 5).padStart(4, "0");
  return `${slugify(base, "pro")}-${suffix}`;
}

/** Increments a slug until it is free: `name`, `name-2`, `name-3`… */
export async function ensureUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base, "item");
  let candidate = root;
  let attempt = 2;
  // Bounded loop: a DB uniqueness constraint is the real guarantee.
  while (attempt < 500) {
    if (!(await exists(candidate))) return candidate;
    candidate = `${root}-${attempt}`;
    attempt += 1;
  }
  return `${root}-${Date.now().toString(36)}`;
}
