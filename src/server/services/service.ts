import type { Prisma, ServiceStatus, PricingType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, conflict, unprocessable, forbidden } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput } from "@/lib/validation/common";
import { citySchema, moneySchema, sanitizedTextSchema } from "@/lib/validation/common";
import { resolveCityInput } from "@/lib/constants/morocco";
import { slugify, ensureUniqueSlug } from "@/lib/utils/slug";
import { canManageService } from "@/lib/permissions";
import type { Actor } from "@/lib/permissions";

/**
 * Service catalogue: public discovery + owner CRUD.
 *
 * Ownership is always resolved from the authenticated actor (`ownerUserId`),
 * never from a client-supplied professional id (§28).
 */

// ─── Validation ──────────────────────────────────────────────────────────────

const keywordList = z
  .union([z.array(z.string().trim().min(1).max(40)), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(/[,،\n]/)))
  .transform((list) => list.map((s) => s.trim()).filter(Boolean).slice(0, 12));

const stringList = z
  .union([z.array(z.string().trim().min(1).max(120)), z.string()])
  .transform((value) => (Array.isArray(value) ? value : value.split(/\n/)))
  .transform((list) => list.map((s) => s.trim()).filter(Boolean).slice(0, 12));

export const createServiceSchema = z
  .object({
    title: sanitizedTextSchema.pipe(z.string().trim().min(5, "title_too_short").max(120, "title_too_long")),
    titleFr: z.string().trim().max(120).optional().nullable(),
    titleEn: z.string().trim().max(120).optional().nullable(),
    description: sanitizedTextSchema.pipe(z.string().trim().min(20, "description_too_short").max(4000, "description_too_long")),
    descriptionFr: z.string().trim().max(4000).optional().nullable(),
    descriptionEn: z.string().trim().max(4000).optional().nullable(),
    categoryId: z.string().uuid("invalid_category"),
    pricingType: z.enum(["FIXED", "STARTING_FROM", "HOURLY", "CUSTOM_QUOTE"]).default("STARTING_FROM"),
    priceMin: moneySchema.default(0),
    priceMax: moneySchema.optional().nullable(),
    durationMin: z.coerce.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
    durationMax: z.coerce.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
    durationUnit: z.enum(["MINUTE", "HOUR", "DAY", "JOB"]).default("HOUR"),
    city: citySchema,
    neighborhood: z.string().trim().max(80).optional().nullable(),
    keywords: keywordList.optional(),
    includes: stringList.optional(),
    warrantyDays: z.coerce.number().int().min(0).max(3650).default(0),
    isUrgentAvailable: z.coerce.boolean().default(false),
    coverImage: z.string().trim().max(2048).optional().nullable(),
    images: z
      .array(z.object({ url: z.string().trim().max(2048), alt: z.string().trim().max(200).optional().nullable() }))
      .max(8)
      .optional(),
    areas: z
      .array(
        z.object({
          city: citySchema,
          neighborhood: z.string().trim().max(80).optional().nullable(),
          radiusKm: z.coerce.number().int().min(1).max(300).default(20),
          travelFee: moneySchema.default(0),
        })
      )
      .max(12)
      .optional(),
    publish: z.coerce.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.pricingType !== "CUSTOM_QUOTE" && data.priceMin <= 0) {
      ctx.addIssue({ code: "custom", path: ["priceMin"], message: "money_must_be_positive" });
    }
    if (data.priceMax != null && data.priceMax < data.priceMin) {
      ctx.addIssue({ code: "custom", path: ["priceMax"], message: "price_max_below_min" });
    }
    if (data.durationMin != null && data.durationMax != null && data.durationMax < data.durationMin) {
      ctx.addIssue({ code: "custom", path: ["durationMax"], message: "duration_max_below_min" });
    }
  });

export type CreateServiceInput = z.infer<typeof createServiceSchema>;
export const updateServiceSchema = createServiceSchema.partial().omit({ publish: true }).extend({
  status: z.enum(["DRAFT", "PUBLISHED", "PAUSED"]).optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

// ─── Public reads ────────────────────────────────────────────────────────────

export type ServiceSort = "relevance" | "rating" | "price_asc" | "price_desc" | "newest";

export interface ListServicesInput extends Partial<PaginationInput> {
  search?: string;
  categorySlug?: string;
  categoryId?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  availability?: "AVAILABLE" | "BUSY" | "UNAVAILABLE";
  urgentOnly?: boolean;
  professionalId?: string;
  sort?: ServiceSort;
  statuses?: ServiceStatus[];
}

export const CARD_INCLUDE = {
  category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true, color: true } },
  professional: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      avatarUrl: true,
      city: true,
      verificationStatus: true,
      availabilityStatus: true,
      completedJobs: true,
      responseTimeMin: true,
      user: { select: { id: true, identity: { select: { fullName: true } } } },
    },
  },
  images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true, alt: true } },
} as const satisfies Prisma.ServiceInclude;

export type ServiceCardRow = Prisma.ServiceGetPayload<{ include: typeof CARD_INCLUDE }>;

function buildServiceWhere(input: ListServicesInput): Prisma.ServiceWhereInput {
  const city = resolveCityInput(input.city ?? null);
  const search = input.search?.trim();

  // City coverage and free-text search each need their own `OR`; spreading two
  // `OR`s into one object literal would silently drop the first, so they are
  // composed explicitly with `AND`.
  const orClauses: Prisma.ServiceWhereInput[] = [];
  if (city) {
    orClauses.push({ OR: [{ city }, { areas: { some: { city } } }] });
  }
  if (search) {
    orClauses.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { titleFr: { contains: search, mode: "insensitive" } },
        { titleEn: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { keywords: { has: search.toLowerCase() } },
        { slug: { contains: slugify(search), mode: "insensitive" } },
        { professional: { businessName: { contains: search, mode: "insensitive" } } },
        { professional: { user: { identity: { fullName: { contains: search, mode: "insensitive" } } } } },
        { category: { name: { contains: search, mode: "insensitive" } } },
        { category: { nameFr: { contains: search, mode: "insensitive" } } },
        { category: { nameEn: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  return {
    // Public discovery only ever sees published services belonging to
    // professionals in good standing.
    ...(input.statuses ? { status: { in: input.statuses } } : { status: "PUBLISHED" as const }),
    professional: {
      user: { status: "ACTIVE", deletedAt: null },
      ...(input.verifiedOnly ? { verificationStatus: "VERIFIED" as const } : {}),
      ...(input.availability ? { availabilityStatus: input.availability } : {}),
      ...(input.professionalId ? { id: input.professionalId } : {}),
    },
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
    ...(input.minPrice != null ? { priceMin: { gte: input.minPrice } } : {}),
    ...(input.maxPrice != null ? { priceMin: { lte: input.maxPrice } } : {}),
    ...(input.minRating ? { ratingAverage: { gte: input.minRating } } : {}),
    ...(input.urgentOnly ? { isUrgentAvailable: true } : {}),
    ...(orClauses.length === 1
      ? orClauses[0]
      : orClauses.length > 1
        ? { AND: orClauses }
        : {}),
  };
}

function buildServiceOrderBy(sort: ServiceSort): Prisma.ServiceOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "price_asc":
      return [{ priceMin: "asc" }];
    case "price_desc":
      return [{ priceMin: "desc" }];
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "relevance":
    default:
      // Reputation-weighted: featured → verified professional → rating → volume.
      return [
        { isFeatured: "desc" },
        { professional: { verificationStatus: "asc" } },
        { ratingAverage: "desc" },
        { requestsCount: "desc" },
        { publishedAt: "desc" },
      ];
  }
}

export async function listServices(input: ListServicesInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(48, Math.max(1, input.perPage ?? 12));
  const where = buildServiceWhere(input);

  const [rows, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: buildServiceOrderBy(input.sort ?? "relevance"),
      skip: (page - 1) * perPage,
      take: perPage,
      include: CARD_INCLUDE,
    }),
    prisma.service.count({ where }),
  ]);

  return { items: rows, ...paginationMeta(page, perPage, total) };
}

/** Price histogram for the filter sidebar — one aggregate query, no N+1. */
export async function servicePriceBounds(input: Omit<ListServicesInput, "minPrice" | "maxPrice"> = {}) {
  const where = buildServiceWhere(input);
  const agg = await prisma.service.aggregate({
    where,
    _min: { priceMin: true },
    _max: { priceMin: true },
    _avg: { priceMin: true },
  });
  return {
    min: agg._min.priceMin ?? 0,
    max: agg._max.priceMin ?? 0,
    avg: Math.round(agg._avg.priceMin ?? 0),
  };
}

export const SERVICE_DETAIL_INCLUDE = {
  ...CARD_INCLUDE,
  images: { orderBy: { sortOrder: "asc" as const } },
  areas: { orderBy: [{ isPrimary: "desc" }, { city: "asc" }] },
  professional: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      headline: true,
      about: true,
      avatarUrl: true,
      city: true,
      neighborhood: true,
      yearsExperience: true,
      languages: true,
      serviceRadiusKm: true,
      verificationStatus: true,
      verifiedAt: true,
      availabilityStatus: true,
      ratingAverage: true,
      ratingCount: true,
      completedJobs: true,
      responseRate: true,
      responseTimeMin: true,
      phonePublic: true,
      publicPhone: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          createdAt: true,
          status: true,
          deletedAt: true,
          identity: { select: { fullName: true } },
        },
      },
    },
  },
} as const satisfies Prisma.ServiceInclude;

export type ServiceDetail = Prisma.ServiceGetPayload<{ include: typeof SERVICE_DETAIL_INCLUDE }>;

/** Accepts a public slug or a UUID so both `/services/[slug]` and API ids work. */
export async function getServicePublic(identifier: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const service = await prisma.service.findUnique({
    where: isUuid ? { id: identifier } : { slug: identifier },
    include: SERVICE_DETAIL_INCLUDE,
  });

  if (!service || service.status !== "PUBLISHED") throw notFound("Service not found.");
  if (service.professional.user.status !== "ACTIVE" || service.professional.user.deletedAt) {
    throw notFound("Service not found.");
  }
  return service;
}

/** Owner/admin view — includes drafts and hidden services. */
export async function getServiceForOwner(actor: Actor, id: string) {
  const service = await prisma.service.findUnique({
    where: { id },
    // `ownerUserId` is a scalar and comes back by default; only the relation
    // needs to be spelled out here.
    include: {
      ...SERVICE_DETAIL_INCLUDE,
      requests: { select: { id: true }, take: 1 },
    },
  });
  if (!service) throw notFound("Service not found.");
  if (!canManageService(actor, service)) throw forbidden();
  return service;
}

export async function listOwnServices(
  userId: string,
  input: Partial<PaginationInput> & { status?: ServiceStatus; search?: string } = {}
) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 12));
  const where: Prisma.ServiceWhereInput = {
    ownerUserId: userId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.search
      ? { OR: [{ title: { contains: input.search, mode: "insensitive" } }, { slug: { contains: input.search, mode: "insensitive" } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        areas: { select: { city: true, neighborhood: true } },
        _count: { select: { requests: true } },
      },
    }),
    prisma.service.count({ where }),
  ]);
  return { items, ...paginationMeta(page, perPage, total) };
}

export async function similarServices(service: { id: string; categoryId: string; city: string }, limit = 4) {
  return prisma.service.findMany({
    where: {
      id: { not: service.id },
      status: "PUBLISHED",
      OR: [{ categoryId: service.categoryId }, { city: service.city }],
      professional: { user: { status: "ACTIVE", deletedAt: null } },
    },
    orderBy: [{ categoryId: "asc" }, { ratingAverage: "desc" }],
    take: limit,
    include: CARD_INCLUDE,
  });
}

// ─── Owner writes ────────────────────────────────────────────────────────────

async function resolveProfessional(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    select: { id: true, verificationStatus: true, city: true },
  });
  if (!profile) throw forbidden("A professional profile is required to manage services.");
  if (profile.verificationStatus === "SUSPENDED") throw forbidden("This professional account is suspended.");
  return profile;
}

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, isActive: true } });
  if (!category) throw unprocessable("The selected category does not exist.");
  if (!category.isActive) throw unprocessable("The selected category is not accepting new services.");
  return category;
}

export async function createService(actor: Actor, input: CreateServiceInput) {
  if (!actor) throw forbidden();
  if (actor.role !== "PROFESSIONAL" && actor.role !== "ADMIN") {
    throw forbidden("Only professionals can publish services.");
  }
  const professional = await resolveProfessional(actor.id);
  await assertCategoryExists(input.categoryId);

  const slug = await ensureUniqueSlug(slugify(input.titleEn || input.title, "service"), async (candidate) =>
    Boolean(await prisma.service.findUnique({ where: { slug: candidate }, select: { id: true } }))
  );

  const status: ServiceStatus = input.publish ? "PUBLISHED" : "DRAFT";

  return prisma.service.create({
    data: {
      slug,
      title: input.title,
      titleFr: input.titleFr ?? null,
      titleEn: input.titleEn ?? null,
      description: input.description,
      descriptionFr: input.descriptionFr ?? null,
      descriptionEn: input.descriptionEn ?? null,
      categoryId: input.categoryId,
      professionalId: professional.id,
      ownerUserId: actor.id,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      pricingType: input.pricingType as PricingType,
      priceMin: input.pricingType === "CUSTOM_QUOTE" ? 0 : input.priceMin,
      priceMax: input.priceMax ?? null,
      durationMin: input.durationMin ?? null,
      durationMax: input.durationMax ?? null,
      durationUnit: input.durationUnit,
      city: input.city,
      neighborhood: input.neighborhood ?? null,
      keywords: input.keywords ?? [],
      includes: input.includes ?? [],
      warrantyDays: input.warrantyDays,
      isUrgentAvailable: input.isUrgentAvailable,
      coverImage: input.coverImage ?? input.images?.[0]?.url ?? null,
      images: input.images?.length
        ? { create: input.images.map((image, index) => ({ url: image.url, alt: image.alt ?? null, sortOrder: index, isCover: index === 0 })) }
        : undefined,
      areas: {
        create: (input.areas?.length
          ? input.areas.map((area, index) => ({
              city: area.city,
              neighborhood: area.neighborhood ?? null,
              radiusKm: area.radiusKm,
              travelFee: area.travelFee,
              isPrimary: index === 0,
            }))
          : [{ city: input.city, neighborhood: input.neighborhood ?? null, radiusKm: 20, travelFee: 0, isPrimary: true }]
        ).map((area) => ({ ...area, professional: { connect: { id: professional.id } } })),
      },
    },
    include: { category: true, areas: true, images: true },
  });
}

export async function updateService(actor: Actor, id: string, input: UpdateServiceInput) {
  const existing = await prisma.service.findUnique({ where: { id }, select: { id: true, ownerUserId: true, status: true, slug: true } });
  if (!existing) throw notFound("Service not found.");
  if (!canManageService(actor, existing)) throw forbidden();

  if (input.categoryId) await assertCategoryExists(input.categoryId);

  const data: Prisma.ServiceUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.titleFr !== undefined) data.titleFr = input.titleFr;
  if (input.titleEn !== undefined) data.titleEn = input.titleEn;
  if (input.description !== undefined) data.description = input.description;
  if (input.descriptionFr !== undefined) data.descriptionFr = input.descriptionFr;
  if (input.descriptionEn !== undefined) data.descriptionEn = input.descriptionEn;
  if (input.categoryId !== undefined) data.category = { connect: { id: input.categoryId } };
  if (input.pricingType !== undefined) data.pricingType = input.pricingType as PricingType;
  if (input.priceMin !== undefined) data.priceMin = input.priceMin;
  if (input.priceMax !== undefined) data.priceMax = input.priceMax;
  if (input.durationMin !== undefined) data.durationMin = input.durationMin;
  if (input.durationMax !== undefined) data.durationMax = input.durationMax;
  if (input.durationUnit !== undefined) data.durationUnit = input.durationUnit;
  if (input.city !== undefined) data.city = input.city;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.keywords !== undefined) data.keywords = input.keywords;
  if (input.includes !== undefined) data.includes = input.includes;
  if (input.warrantyDays !== undefined) data.warrantyDays = input.warrantyDays;
  if (input.isUrgentAvailable !== undefined) data.isUrgentAvailable = input.isUrgentAvailable;
  if (input.coverImage !== undefined) data.coverImage = input.coverImage;

  // Publishing rules: a CUSTOM_QUOTE service may publish with price 0, others
  // need a positive starting price.
  const nextPricing = input.pricingType ?? undefined;
  const nextPriceMin = input.priceMin;
  if (input.status === "PUBLISHED" || (nextPricing !== undefined && nextPriceMin !== undefined)) {
    const pricing = nextPricing ?? (await prisma.service.findUnique({ where: { id }, select: { pricingType: true } }))?.pricingType;
    const price = nextPriceMin ?? (await prisma.service.findUnique({ where: { id }, select: { priceMin: true } }))?.priceMin ?? 0;
    if (input.status === "PUBLISHED" && pricing !== "CUSTOM_QUOTE" && price <= 0) {
      throw unprocessable("Set a starting price before publishing this service.");
    }
  }

  if (input.status !== undefined) {
    data.status = input.status;
    if (input.status === "PUBLISHED") data.publishedAt = new Date();
  }

  return prisma.$transaction(async (tx) => {
    if (input.images !== undefined) {
      await tx.serviceImage.deleteMany({ where: { serviceId: id } });
      if (input.images.length) {
        await tx.serviceImage.createMany({
          data: input.images.map((image, index) => ({
            serviceId: id,
            url: image.url,
            alt: image.alt ?? null,
            sortOrder: index,
            isCover: index === 0,
          })),
        });
      }
      if (!input.coverImage && input.images[0]) data.coverImage = input.images[0].url;
    }
    if (input.areas !== undefined && input.areas.length) {
      const current = await tx.service.findUnique({
        where: { id },
        select: { professionalId: true },
      });
      const professionalId = current!.professionalId;
      await tx.serviceArea.deleteMany({ where: { serviceId: id } });
      await tx.serviceArea.createMany({
        data: input.areas.map((area, index) => ({
          serviceId: id,
          professionalId,
          city: area.city,
          neighborhood: area.neighborhood ?? null,
          radiusKm: area.radiusKm,
          travelFee: area.travelFee,
          isPrimary: index === 0,
        })),
      });
    }
    return tx.service.update({
      where: { id },
      data,
      include: { category: true, areas: true, images: true },
    });
  });
}

export async function setServiceStatus(actor: Actor, id: string, status: ServiceStatus) {
  const existing = await prisma.service.findUnique({ where: { id }, select: { id: true, ownerUserId: true, priceMin: true, pricingType: true } });
  if (!existing) throw notFound("Service not found.");
  if (!canManageService(actor, existing)) throw forbidden();

  if (status === "PUBLISHED" && existing.pricingType !== "CUSTOM_QUOTE" && existing.priceMin <= 0) {
    throw unprocessable("Set a starting price before publishing this service.");
  }

  return prisma.service.update({
    where: { id },
    data: { status, ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}) },
  });
}

export async function deleteService(actor: Actor, id: string) {
  const existing = await prisma.service.findUnique({
    where: { id },
    select: { id: true, ownerUserId: true, _count: { select: { bookings: true } } },
  });
  if (!existing) throw notFound("Service not found.");
  if (!canManageService(actor, existing)) throw forbidden();
  if (existing._count.bookings > 0 && actor?.role !== "ADMIN") {
    // Protect the audit trail: pause instead of hard-deleting services that
    // already produced bookings.
    throw conflict("This service has bookings and cannot be deleted. Pause it instead.");
  }
  await prisma.service.delete({ where: { id } });
  return { id, deleted: true };
}

export async function incrementServiceView(id: string) {
  await prisma.service.update({ where: { id }, data: { viewsCount: { increment: 1 } } }).catch(() => undefined);
}

/** Admin moderation. */
export async function hideService(adminId: string, id: string, reason?: string) {
  const [service] = await prisma.$transaction([
    prisma.service.update({ where: { id }, data: { status: "HIDDEN" } }),
    prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: "SERVICE_HIDDEN",
        targetType: "SERVICE",
        targetId: id,
        metadata: { reason: reason ?? null },
      },
    }),
  ]);
  return service;
}

export async function unhideService(adminId: string, id: string) {
  const [service] = await prisma.$transaction([
    prisma.service.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
    prisma.auditLog.create({
      data: { actorId: adminId, action: "SERVICE_RESTORED", targetType: "SERVICE", targetId: id },
    }),
  ]);
  return service;
}
