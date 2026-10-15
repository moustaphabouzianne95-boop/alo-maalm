import { z } from "zod";
import { paginationSchema } from "@/lib/validation/common";

/**
 * Query-string schemas for the list endpoints (§9, §11, §12).
 *
 * Every filter that the UI persists in the URL has a matching schema here, so
 * a hand-edited URL can never inject an unvalidated value into a Prisma query.
 */

const boolish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1" || v === "on")
  .optional();

const optionalString = z
  .string()
  .trim()
  .max(160)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalNumber = z.coerce.number().int().min(0).max(100_000_000).optional();

export const listCategoriesQuery = paginationSchema
  .extend({
    search: optionalString,
    all: boolish,
  })
  // The catalogue is ~20 rows and the navigation renders it in one pass, so the
  // default page size is the whole set rather than the generic 12.
  .extend({ perPage: z.coerce.number().int().min(1).max(100).default(50) });
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuery>;

export const listServicesQuery = paginationSchema.extend({
  search: optionalString,
  category: optionalString,
  city: optionalString,
  minPrice: optionalNumber,
  maxPrice: optionalNumber,
  minRating: z.coerce.number().min(1).max(5).optional(),
  verified: boolish,
  availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]).optional(),
  urgent: boolish,
  professionalId: optionalString,
  sort: z.enum(["relevance", "rating", "price_asc", "price_desc", "newest"]).default("relevance"),
});
export type ListServicesQuery = z.infer<typeof listServicesQuery>;

export const listProfessionalsQuery = paginationSchema.extend({
  search: optionalString,
  category: optionalString,
  city: optionalString,
  verified: boolish,
  availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  sort: z.enum(["relevance", "rating", "jobs", "newest", "response"]).default("relevance"),
});
export type ListProfessionalsQuery = z.infer<typeof listProfessionalsQuery>;

export const listRequestsQuery = paginationSchema.extend({
  search: optionalString,
  city: optionalString,
  category: optionalString,
  status: z.enum(["OPEN", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "EXPIRED"]).optional(),
  urgency: z.enum(["NORMAL", "URGENT", "EMERGENCY"]).optional(),
  minBudget: optionalNumber,
  maxBudget: optionalNumber,
  matched: boolish,
  sort: z.enum(["newest", "budget_desc", "urgency", "offers"]).default("newest"),
});
export type ListRequestsQuery = z.infer<typeof listRequestsQuery>;

export const listOffersQuery = paginationSchema.extend({
  scope: z.enum(["sent", "received"]).default("sent"),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"]).optional(),
  search: optionalString,
});
export type ListOffersQuery = z.infer<typeof listOffersQuery>;

export const listBookingsQuery = paginationSchema.extend({
  tab: z.enum(["upcoming", "active", "completed", "cancelled", "all"]).default("active"),
  status: z.enum(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  search: optionalString,
  city: optionalString,
});
export type ListBookingsQuery = z.infer<typeof listBookingsQuery>;

export const listConversationsQuery = paginationSchema.extend({
  search: optionalString,
  unread: boolish,
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuery>;

export const listMessagesQuery = paginationSchema.extend({
  before: optionalString,
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuery>;

export const listNotificationsQuery = paginationSchema.extend({
  unread: boolish,
  type: optionalString,
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

export const listFavoritesQuery = paginationSchema.extend({
  targetType: z.enum(["SERVICE", "PROFESSIONAL"]).optional(),
});
export type ListFavoritesQuery = z.infer<typeof listFavoritesQuery>;

export const listReviewsQuery = paginationSchema.extend({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  professionalId: optionalString,
  serviceId: optionalString,
  all: boolish,
});
export type ListReviewsQuery = z.infer<typeof listReviewsQuery>;

export const listUsersQuery = paginationSchema.extend({
  role: z.enum(["CUSTOMER", "PROFESSIONAL", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "DEACTIVATED"]).optional(),
  verification: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]).optional(),
  city: optionalString,
  search: optionalString,
  sort: z.enum(["newest", "oldest", "rating", "name", "activity"]).default("newest"),
});
export type ListUsersQuery = z.infer<typeof listUsersQuery>;

export const listReportsQuery = paginationSchema.extend({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]).optional(),
  reason: z.enum(["SPAM", "FRAUD", "INAPPROPRIATE", "HARASSMENT", "FAKE_PROFILE", "OTHER"]).optional(),
  targetType: z.enum(["USER", "PROFESSIONAL", "SERVICE", "REVIEW", "REQUEST", "OFFER", "MESSAGE"]).optional(),
  search: optionalString,
  scope: z.enum(["admin", "mine"]).default("admin"),
});
export type ListReportsQuery = z.infer<typeof listReportsQuery>;

export const listAuditQuery = paginationSchema.extend({
  action: optionalString,
  targetType: optionalString,
  targetId: optionalString,
});
export type ListAuditQuery = z.infer<typeof listAuditQuery>;

/** Splits a paginated service result into `{ data, meta }` for the envelope. */
export function splitPage<T>(result: { items: T[]; total: number } & Record<string, unknown>) {
  const { items, ...meta } = result;
  return { data: items, meta: meta as Record<string, unknown> };
}
