import { z } from "zod";
import { CITY_SLUGS, NEIGHBORHOODS } from "@/lib/constants/morocco";
import { normalizeMoroccanPhone } from "@/lib/utils";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

/**
 * Shared validation primitives. Every server endpoint composes these so the
 * rules stay identical across the API, server actions and the client forms.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .email()
  .transform((v) => v.toLowerCase());

/**
 * Accepts the formats Moroccans actually type — `0612345678`, `06 12 34 56 78`,
 * `+212612345678`, `00212 6 12 34 56 78` — and normalises to E.164.
 */
export const moroccanPhoneSchema = z
  .string()
  .trim()
  .min(9)
  .max(20)
  .refine((v) => /^[0-9+\s().-]+$/.test(v), { message: "invalid_phone" })
  // `?? ""` keeps the inferred output a plain `string`; the refine below then
  // rejects the empty result, which is how an invalid number surfaces.
  .transform((v) => normalizeMoroccanPhone(v) ?? "")
  .refine((v) => v.length >= 9, { message: "invalid_moroccan_phone" });

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: "password_too_short" })
  .max(PASSWORD_MAX_LENGTH, { message: "password_too_long" })
  .refine((v) => /[a-zA-Z\u0600-\u06FF]/.test(v) && /\d/.test(v), {
    message: "password_needs_letter_and_digit",
  });

export const citySchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .refine((v) => CITY_SLUGS.includes(v.toLowerCase()), { message: "unknown_city" })
  .transform((v) => v.toLowerCase());

export const optionalCitySchema = citySchema.optional().or(z.literal("").transform(() => undefined));

export function neighborhoodSchema(citySlug?: string) {
  const allowed = citySlug ? (NEIGHBORHOODS[citySlug] ?? []).flatMap((n) => [n.ar, n.fr, n.en]) : null;
  const base = z.string().trim().max(80);
  if (!allowed || allowed.length === 0) return base.optional();
  // Free-text is allowed (people know their own quartier) but length-capped.
  return base.optional();
}

export const moneySchema = z.coerce
  .number({ error: "invalid_number" })
  .int({ error: "money_must_be_whole_dirhams" })
  .min(0, { error: "money_must_be_positive" })
  .max(10_000_000, { error: "money_too_large" });

export const positiveMoneySchema = moneySchema.refine((v) => v > 0, { error: "money_must_be_positive" });

export const ratingSchema = z.coerce
  .number({ error: "invalid_rating" })
  .int({ error: "rating_must_be_integer" })
  .min(1, { error: "rating_min" })
  .max(5, { error: "rating_max" });

export const uuidSchema = z.string().uuid({ error: "invalid_id" });

export const titleSchema = z.string().trim().min(5, { error: "title_too_short" }).max(120, { error: "title_too_long" });

export const descriptionSchema = z
  .string()
  .trim()
  .min(20, { error: "description_too_short" })
  .max(4000, { error: "description_too_long" });

export const shortTextSchema = z.string().trim().max(500);

/** Page number / page size with hard caps so a client can't request 100k rows. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(12),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function paginationMeta(page: number, perPage: number, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    from: total === 0 ? 0 : (page - 1) * perPage + 1,
    to: Math.min(total, page * perPage),
  };
}

/** ISO date (`yyyy-MM-dd`) that also refuses dates in the deep past. */
export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "invalid_date" })
  .refine((v) => !Number.isNaN(new Date(v).getTime()), { error: "invalid_date" })
  .transform((v) => new Date(`${v}T00:00:00.000Z`));

export const timeWindowSchema = z
  .string()
  .trim()
  .max(24)
  .refine((v) => v === "flexible" || /^\d{2}:\d{2}(-\d{2}:\d{2})?$/.test(v), { error: "invalid_time" });

export const urlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v.startsWith("/") || v.startsWith("http://") || v.startsWith("https://"), {
    error: "invalid_url",
  });

/** Rejects control characters that have no business in user-generated text. */
export function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<\s*(script|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .trim();
}

export const sanitizedTextSchema = z
  .string()
  .transform((v) => sanitizeText(v));
