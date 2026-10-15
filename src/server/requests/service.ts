import type { Prisma, RequestStatus, Urgency } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable, conflict } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, citySchema, moneySchema, sanitizedTextSchema } from "@/lib/validation/common";
import { resolveCityInput, cityName } from "@/lib/constants/morocco";
import { makeReference } from "@/lib/utils";
import { canManageRequest, canViewRequest, type Actor } from "@/lib/permissions";
import { createNotifications, type CreateNotificationInput } from "@/server/notifications/service";

/**
 * Customer service requests — the demand side of the marketplace.
 *
 * Lifecycle (§14): OPEN → RECEIVING_OFFERS → OFFER_SELECTED → IN_PROGRESS →
 * COMPLETED, with CANCELLED / EXPIRED as terminal side-exits. Transitions are
 * validated here so an invalid state can never be persisted.
 */

export const REQUEST_TTL_DAYS = 14;
const MAX_REQUEST_IMAGES = 5;

export const createRequestSchema = z
  .object({
    title: sanitizedTextSchema.pipe(z.string().trim().min(5, "title_too_short").max(120, "title_too_long")),
    categoryId: z.string().uuid("invalid_category"),
    serviceId: z.string().uuid().optional().nullable(),
    description: sanitizedTextSchema.pipe(z.string().trim().min(20, "description_too_short").max(4000, "description_too_long")),
    city: citySchema,
    neighborhood: z.string().trim().max(80).optional().nullable(),
    address: sanitizedTextSchema.pipe(z.string().trim().max(300)).optional().nullable(),
    budgetMin: moneySchema.optional().nullable(),
    budgetMax: moneySchema.optional().nullable(),
    preferredDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
      .optional()
      .nullable()
      .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
    preferredTime: z.string().trim().max(24).optional().nullable(),
    urgency: z.enum(["NORMAL", "URGENT", "EMERGENCY"]).default("NORMAL"),
    images: z.array(z.string().trim().max(2048)).max(MAX_REQUEST_IMAGES).optional(),
    maxOffers: z.coerce.number().int().min(1).max(25).default(10),
  })
  .superRefine((data, ctx) => {
    if (data.budgetMin != null && data.budgetMax != null && data.budgetMax < data.budgetMin) {
      ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "budget_max_below_min" });
    }
    if (data.preferredDate && data.preferredDate.getTime() < Date.now() - 1000 * 60 * 60 * 24) {
      ctx.addIssue({ code: "custom", path: ["preferredDate"], message: "date_in_past" });
    }
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export const updateRequestSchema = createRequestSchema.partial().omit({ maxOffers: true });
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

/** Legal transitions. Anything not listed here is rejected. */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  OPEN: ["RECEIVING_OFFERS", "OFFER_SELECTED", "CANCELLED", "EXPIRED"],
  RECEIVING_OFFERS: ["OFFER_SELECTED", "CANCELLED", "EXPIRED"],
  OFFER_SELECTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return REQUEST_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Statuses a professional may still submit an offer against. */
export const OFFERABLE_STATUSES: RequestStatus[] = ["OPEN", "RECEIVING_OFFERS"];

// ─── Reads ───────────────────────────────────────────────────────────────────

export type RequestScope = "customer" | "professional" | "admin";

export interface ListRequestsInput extends Partial<PaginationInput> {
  scope: RequestScope;
  actorId?: string;
  search?: string;
  city?: string;
  categorySlug?: string;
  status?: RequestStatus;
  urgency?: Urgency;
  minBudget?: number;
  maxBudget?: number;
  sort?: "newest" | "budget_desc" | "urgency" | "offers";
  /** Professionals: only requests in cities/categories they cover. */
  matchedOnly?: boolean;
}

const LIST_INCLUDE = {
  category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true, color: true } },
  customer: { select: { id: true, createdAt: true, identity: { select: { fullName: true, firstName: true, avatarUrl: true } } } },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true } },
  _count: { select: { offers: true } },
} as const satisfies Prisma.ServiceRequestInclude;

export type RequestListRow = Prisma.ServiceRequestGetPayload<{ include: typeof LIST_INCLUDE }>;

function buildRequestWhere(input: ListRequestsInput): Prisma.ServiceRequestWhereInput {
  const city = resolveCityInput(input.city ?? null);
  const base: Prisma.ServiceRequestWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.urgency ? { urgency: input.urgency } : {}),
    ...(city ? { city } : {}),
    ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
    ...(input.minBudget != null ? { budgetMax: { gte: input.minBudget } } : {}),
    ...(input.maxBudget != null ? { budgetMin: { lte: input.maxBudget } } : {}),
    ...(input.search
      ? {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
            { reference: { contains: input.search.toUpperCase(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  switch (input.scope) {
    case "customer":
      return { ...base, customerId: input.actorId };
    case "professional":
      // Base filters only — the "can this professional serve it?" constraint is
      // composed separately in `listRequests` so it stays readable.
      return base;
    case "admin":
    default:
      return base;
  }
}

function buildRequestOrderBy(sort: ListRequestsInput["sort"]): Prisma.ServiceRequestOrderByWithRelationInput[] {
  switch (sort) {
    case "budget_desc":
      return [{ budgetMax: "desc" }, { createdAt: "desc" }];
    case "urgency":
      return [{ urgency: "desc" }, { createdAt: "desc" }];
    case "offers":
      return [{ offersCount: "desc" }, { createdAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export async function listRequests(input: ListRequestsInput) {
  // A signed-in customer or professional is always scoped to their own rows.
  // Without a session the "professional" scope degrades to the public board,
  // which only ever exposes demand that still accepts offers.
  const publicBoard = input.scope === "professional" && !input.actorId;
  if (input.scope === "customer" && !input.actorId) throw forbidden();

  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 10));
  const where = buildRequestWhere(input);

  // For professionals we additionally restrict to demand they can serve:
  // their own offers, or open requests in a city/category they cover.
  const professionalWhere: Prisma.ServiceRequestWhereInput | undefined = publicBoard
    ? { status: { in: OFFERABLE_STATUSES } }
    : input.scope === "professional" && input.actorId
      ? {
          OR: [
            { offers: { some: { professionalId: input.actorId } } },
            {
              status: { in: OFFERABLE_STATUSES },
              ...(input.matchedOnly
                ? {
                    AND: [
                      {
                        OR: [
                          {
                            category: {
                              services: {
                                some: {
                                  status: "PUBLISHED",
                                  professional: { userId: input.actorId },
                                },
                              },
                            },
                          },
                        ],
                      },
                    ],
                  }
                : {}),
            },
          ],
        }
      : undefined;

  const finalWhere: Prisma.ServiceRequestWhereInput = professionalWhere
    ? { AND: [where, professionalWhere] }
    : where;

  const [items, total] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: finalWhere,
      orderBy: buildRequestOrderBy(input.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      include: LIST_INCLUDE,
    }),
    prisma.serviceRequest.count({ where: finalWhere }),
  ]);

  // Which of these has the current professional already offered on? One query.
  let offeredRequestIds = new Set<string>();
  if (!publicBoard && input.scope === "professional" && input.actorId && items.length) {
    const offered = await prisma.offer.findMany({
      where: { professionalId: input.actorId, requestId: { in: items.map((i) => i.id) } },
      select: { requestId: true },
    });
    offeredRequestIds = new Set(offered.map((o) => o.requestId));
  }

  return {
    items,
    offeredRequestIds: [...offeredRequestIds],
    ...paginationMeta(page, perPage, total),
  };
}

export const REQUEST_DETAIL_INCLUDE = {
  category: true,
  customer: {
    select: {
      id: true,
      createdAt: true,
      identity: { select: { fullName: true, firstName: true, avatarUrl: true } },
    },
  },
  service: { select: { id: true, slug: true, title: true, priceMin: true, pricingType: true } },
  images: { orderBy: { sortOrder: "asc" as const } },
  offers: {
    orderBy: [{ status: "asc" }, { price: "asc" }, { createdAt: "asc" }],
    include: {
      professional: {
        select: {
          id: true,
          identity: { select: { fullName: true, avatarUrl: true } },
          professionalProfile: {
            select: {
              id: true,
              slug: true,
              businessName: true,
              avatarUrl: true,
              city: true,
              verificationStatus: true,
              ratingAverage: true,
              ratingCount: true,
              completedJobs: true,
              responseTimeMin: true,
              yearsExperience: true,
            },
          },
        },
      },
      booking: { select: { id: true, reference: true, status: true } },
    },
  },
  bookings: { select: { id: true, reference: true, status: true, scheduledDate: true, scheduledTime: true, price: true } },
} as const satisfies Prisma.ServiceRequestInclude;

export type RequestDetail = Prisma.ServiceRequestGetPayload<{ include: typeof REQUEST_DETAIL_INCLUDE }>;

export async function getRequest(actor: Actor, id: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: REQUEST_DETAIL_INCLUDE,
  });
  if (!request) throw notFound("Request not found.");
  if (!canViewRequest(actor, request)) throw forbidden();
  return request;
}

/** Owner-only variant used before mutations. */
export async function getRequestForUpdate(actor: Actor, id: string) {
  const request = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!request) throw notFound("Request not found.");
  if (!canManageRequest(actor, request)) throw forbidden();
  return request;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

async function uniqueReference(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reference = makeReference("REQ");
    const exists = await prisma.serviceRequest.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  return makeReference("REQ", 8);
}

/** Professionals who should hear about a new request — one grouped query. */
async function matchingProfessionalUserIds(categoryId: string, city: string, limit = 25) {
  const rows = await prisma.professionalProfile.findMany({
    where: {
      verificationStatus: { in: ["VERIFIED", "PENDING"] },
      availabilityStatus: { not: "UNAVAILABLE" },
      user: { status: "ACTIVE", deletedAt: null },
      services: { some: { status: "PUBLISHED", categoryId } },
      OR: [{ city }, { areas: { some: { city } } }],
    },
    select: { userId: true },
    take: limit,
  });
  return rows.map((r) => r.userId);
}

export async function createRequest(actor: Actor, input: CreateRequestInput) {
  if (!actor) throw forbidden();
  if (actor.role !== "CUSTOMER" && actor.role !== "ADMIN") {
    throw forbidden("Only customers can post service requests.");
  }

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, isActive: true, name: true },
  });
  if (!category || !category.isActive) throw unprocessable("The selected category is not available.");

  if (input.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, status: true },
    });
    if (!service || service.status !== "PUBLISHED") throw unprocessable("The selected service is not available.");
  }

  const reference = await uniqueReference();
  const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);

  const request = await prisma.serviceRequest.create({
    data: {
      reference,
      customerId: actor.id,
      categoryId: input.categoryId,
      serviceId: input.serviceId ?? null,
      title: input.title,
      description: input.description,
      city: input.city,
      neighborhood: input.neighborhood ?? null,
      address: input.address ?? null,
      budgetMin: input.budgetMin ?? null,
      budgetMax: input.budgetMax ?? null,
      preferredDate: input.preferredDate ?? null,
      preferredTime: input.preferredTime ?? null,
      urgency: input.urgency as Urgency,
      status: "OPEN",
      maxOffers: input.maxOffers,
      expiresAt,
      images: input.images?.length
        ? { create: input.images.map((url, index) => ({ url, sortOrder: index })) }
        : undefined,
    },
    include: LIST_INCLUDE,
  });

  // Notify professionals who can actually serve this job.
  const recipients = await matchingProfessionalUserIds(input.categoryId, input.city);
  if (recipients.length) {
    const notifications: CreateNotificationInput[] = recipients.map((userId) => ({
      userId,
      type: "NEW_REQUEST",
      role: "PROFESSIONAL",
      title: `طلب جديد: ${input.title}`,
      body: `${category.name} · ${cityName(input.city, "ar")}${input.budgetMax ? ` · حتى ${input.budgetMax} د.م.` : ""}`,
      data: { requestId: request.id, requestReference: reference, actorName: request.customer.identity?.fullName ?? undefined, amount: input.budgetMax ?? undefined },
      linkTo: `/professional/requests/${request.id}`,
    }));
    await createNotifications(notifications).catch(() => undefined);
  }

  return request;
}

export async function updateRequest(actor: Actor, id: string, input: UpdateRequestInput) {
  const existing = await getRequestForUpdate(actor, id);
  if (!OFFERABLE_STATUSES.includes(existing.status)) {
    throw unprocessable("Only open requests can be edited.");
  }
  if (existing.offersCount > 0) {
    throw unprocessable("This request already received offers and can no longer be edited.");
  }

  const data: Prisma.ServiceRequestUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true, isActive: true } });
    if (!category?.isActive) throw unprocessable("The selected category is not available.");
    data.category = { connect: { id: input.categoryId } };
  }
  if (input.city !== undefined) data.city = input.city;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.address !== undefined) data.address = input.address;
  if (input.budgetMin !== undefined) data.budgetMin = input.budgetMin;
  if (input.budgetMax !== undefined) data.budgetMax = input.budgetMax;
  if (input.preferredDate !== undefined) data.preferredDate = input.preferredDate;
  if (input.preferredTime !== undefined) data.preferredTime = input.preferredTime;
  if (input.urgency !== undefined) data.urgency = input.urgency as Urgency;

  return prisma.$transaction(async (tx) => {
    if (input.images !== undefined) {
      await tx.requestImage.deleteMany({ where: { requestId: id } });
      if (input.images.length) {
        await tx.requestImage.createMany({
          data: input.images.map((url, index) => ({ requestId: id, url, sortOrder: index })),
        });
      }
    }
    return tx.serviceRequest.update({ where: { id }, data, include: LIST_INCLUDE });
  });
}

export async function cancelRequest(actor: Actor, id: string, reason?: string) {
  const existing = await getRequestForUpdate(actor, id);
  if (!canTransitionRequest(existing.status, "CANCELLED")) {
    throw unprocessable("This request can no longer be cancelled.");
  }

  const [updated] = await prisma.$transaction([
    prisma.serviceRequest.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledReason: reason ?? null,
        closedAt: new Date(),
      },
    }),
    // Competing offers are closed with the request.
    prisma.offer.updateMany({
      where: { requestId: id, status: "PENDING" },
      data: { status: "EXPIRED", respondedAt: new Date() },
    }),
  ]);

  const offers = await prisma.offer.findMany({
    where: { requestId: id },
    select: { professionalId: true },
  });
  if (offers.length) {
    await createNotifications(
      offers.map((offer) => ({
        userId: offer.professionalId,
        type: "OFFER_REJECTED" as const,
        role: "PROFESSIONAL" as const,
        title: "تم إلغاء الطلب",
        body: `الطلب ${existing.reference} أُلغي من طرف العميل.`,
        data: { requestId: id, requestReference: existing.reference },
        linkTo: "/professional/requests",
      }))
    ).catch(() => undefined);
  }

  return updated;
}

export async function deleteRequest(actor: Actor, id: string) {
  const existing = await getRequestForUpdate(actor, id);
  if (existing.status === "IN_PROGRESS" || existing.status === "COMPLETED") {
    throw conflict("A request with an active or completed booking cannot be deleted.");
  }
  await prisma.serviceRequest.delete({ where: { id } });
  return { id, deleted: true };
}

/** Marks the request as receiving offers once its first offer lands. */
export async function markRequestReceivingOffers(requestId: string, tx: Prisma.TransactionClient) {
  await tx.serviceRequest.updateMany({
    where: { id: requestId, status: "OPEN" },
    data: { status: "RECEIVING_OFFERS" },
  });
}

export async function incrementRequestView(id: string) {
  await prisma.serviceRequest.update({ where: { id }, data: { viewsCount: { increment: 1 } } }).catch(() => undefined);
}

/**
 * Closes requests past their `expiresAt`. Designed to be called from a cron
 * route or a queue worker — it is idempotent and safe to run concurrently.
 */
export async function expireStaleRequests(batchSize = 100) {
  const now = new Date();
  const stale = await prisma.serviceRequest.findMany({
    where: { status: { in: ["OPEN", "RECEIVING_OFFERS"] }, expiresAt: { lt: now } },
    select: { id: true, reference: true, customerId: true },
    take: batchSize,
  });
  if (!stale.length) return { expired: 0 };

  await prisma.$transaction([
    prisma.serviceRequest.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: "EXPIRED", closedAt: now },
    }),
    prisma.offer.updateMany({
      where: { requestId: { in: stale.map((s) => s.id) }, status: "PENDING" },
      data: { status: "EXPIRED" },
    }),
  ]);

  await createNotifications(
    stale.map((request) => ({
      userId: request.customerId,
      type: "REQUEST_EXPIRING" as const,
      role: "CUSTOMER" as const,
      title: "انتهت صلاحية طلبك",
      body: `الطلب ${request.reference} أُغلق تلقائياً. يمكنك نشر طلب جديد.`,
      data: { requestId: request.id, requestReference: request.reference },
      linkTo: "/dashboard/requests",
    }))
  ).catch(() => undefined);

  return { expired: stale.length };
}
