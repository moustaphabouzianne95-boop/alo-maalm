import { Prisma, type VerificationStatus, type AvailabilityStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput } from "@/lib/validation/common";
import { resolveCityInput } from "@/lib/constants/morocco";

/**
 * Professional directory + public profile reads.
 *
 * Trust & safety (§51): the public projection never includes `User.phone`,
 * `User.email` or `passwordHash`. A phone number is only exposed when the
 * professional explicitly set `phonePublic = true`.
 */

export const PUBLIC_PROFILE_SELECT = {
  id: true,
  slug: true,
  businessName: true,
  headline: true,
  about: true,
  avatarUrl: true,
  coverUrl: true,
  city: true,
  neighborhood: true,
  serviceRadiusKm: true,
  yearsExperience: true,
  languages: true,
  website: true,
  phonePublic: true,
  publicPhone: true,
  verificationStatus: true,
  verifiedAt: true,
  availabilityStatus: true,
  ratingAverage: true,
  ratingCount: true,
  completedJobs: true,
  responseRate: true,
  responseTimeMin: true,
  isFeatured: true,
  createdAt: true,
  user: { select: { id: true, createdAt: true, identity: { select: { fullName: true, firstName: true, avatarUrl: true } } } },
} as const satisfies Prisma.ProfessionalProfileSelect;

export type PublicProfessional = Prisma.ProfessionalProfileGetPayload<{ select: typeof PUBLIC_PROFILE_SELECT }>;

export interface ProfessionalCard {
  id: string;
  userId: string;
  slug: string;
  name: string;
  headline: string | null;
  avatarUrl: string | null;
  city: string;
  neighborhood: string | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
  availabilityStatus: AvailabilityStatus;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  responseRate: number;
  responseTimeMin: number;
  yearsExperience: number;
  isFeatured: boolean;
  memberSince: Date;
  categories: { id: string; slug: string; name: string; icon: string }[];
}

export function toCard(profile: PublicProfessional & { services?: { category: { id: string; slug: string; name: string; icon: string } }[] }): ProfessionalCard {
  const categories: ProfessionalCard["categories"] = [];
  const seen = new Set<string>();
  for (const service of profile.services ?? []) {
    if (seen.has(service.category.id)) continue;
    seen.add(service.category.id);
    categories.push(service.category);
  }
  return {
    id: profile.id,
    userId: profile.user.id,
    slug: profile.slug,
    name: profile.businessName?.trim() || profile.user.identity?.fullName || "—",
    headline: profile.headline,
    avatarUrl: profile.avatarUrl ?? profile.user.identity?.avatarUrl ?? null,
    city: profile.city,
    neighborhood: profile.neighborhood,
    verified: profile.verificationStatus === "VERIFIED",
    verificationStatus: profile.verificationStatus,
    availabilityStatus: profile.availabilityStatus,
    ratingAverage: Number(profile.ratingAverage),
    ratingCount: profile.ratingCount,
    completedJobs: profile.completedJobs,
    responseRate: profile.responseRate,
    responseTimeMin: profile.responseTimeMin,
    yearsExperience: profile.yearsExperience,
    isFeatured: profile.isFeatured,
    memberSince: profile.user.createdAt,
    categories,
  };
}

export type ProfessionalSort = "relevance" | "rating" | "jobs" | "newest" | "response";

export interface ListProfessionalsInput extends Partial<PaginationInput> {
  search?: string;
  city?: string;
  categorySlug?: string;
  verifiedOnly?: boolean;
  availability?: AvailabilityStatus;
  minRating?: number;
  sort?: ProfessionalSort;
}

function buildWhere(input: ListProfessionalsInput): Prisma.ProfessionalProfileWhereInput {
  const city = resolveCityInput(input.city ?? null);

  // City coverage and search each need an `OR`; two `OR` keys in one object
  // literal would silently overwrite each other, so they compose via `AND`.
  const orClauses: Prisma.ProfessionalProfileWhereInput[] = [];
  if (city) {
    orClauses.push({ OR: [{ city }, { areas: { some: { city } } }] });
  }
  if (input.search) {
    orClauses.push({
      OR: [
        { businessName: { contains: input.search, mode: "insensitive" } },
        { headline: { contains: input.search, mode: "insensitive" } },
        { slug: { contains: input.search, mode: "insensitive" } },
        { user: { identity: { fullName: { contains: input.search, mode: "insensitive" } } } },
        { services: { some: { title: { contains: input.search, mode: "insensitive" } } } },
      ],
    });
  }

  return {
    // Only profiles whose owner is in good standing appear publicly.
    user: { status: "ACTIVE", deletedAt: null },
    ...(input.verifiedOnly ? { verificationStatus: "VERIFIED" as const } : {}),
    ...(input.availability ? { availabilityStatus: input.availability } : {}),
    ...(input.minRating ? { ratingAverage: { gte: input.minRating } } : {}),
    ...(input.categorySlug
      ? { services: { some: { status: "PUBLISHED", category: { slug: input.categorySlug } } } }
      : {}),
    ...(orClauses.length === 1
      ? orClauses[0]
      : orClauses.length > 1
        ? { AND: orClauses }
        : {}),
  };
}

function buildOrderBy(sort: ProfessionalSort = "relevance"): Prisma.ProfessionalProfileOrderByWithRelationInput[] {
  switch (sort) {
    case "rating":
      return [{ ratingAverage: "desc" }, { ratingCount: "desc" }];
    case "jobs":
      return [{ completedJobs: "desc" }, { ratingAverage: "desc" }];
    case "newest":
      return [{ createdAt: "desc" }];
    case "response":
      return [{ responseTimeMin: "asc" }, { responseRate: "desc" }];
    case "relevance":
    default:
      // Featured and verified first, then reputation, then recency.
      return [
        { isFeatured: "desc" },
        { verificationStatus: "asc" }, // PENDING < REJECTED < SUSPENDED < VERIFIED alphabetically…
        { ratingAverage: "desc" },
        { completedJobs: "desc" },
        { createdAt: "desc" },
      ];
  }
}

export async function listProfessionals(input: ListProfessionalsInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(48, Math.max(1, input.perPage ?? 12));
  const where = buildWhere(input);

  const [rows, total] = await Promise.all([
    prisma.professionalProfile.findMany({
      where,
      // `verificationStatus: asc` would sort alphabetically; rank verified
      // first explicitly through a two-pass order instead.
      orderBy: input.sort === "relevance" ? [{ isFeatured: "desc" }, { ratingAverage: "desc" }, { completedJobs: "desc" }] : buildOrderBy(input.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        ...PUBLIC_PROFILE_SELECT,
        services: {
          where: { status: "PUBLISHED" },
          select: { category: { select: { id: true, slug: true, name: true, icon: true } } },
          distinct: ["categoryId"],
          take: 4,
        },
      },
    }),
    prisma.professionalProfile.count({ where }),
  ]);

  // Verified professionals rank above pending ones at equal reputation.
  const items = rows
    .map((row) => toCard(row))
    .sort((a, b) => {
      if (input.sort && input.sort !== "relevance") return 0;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return 0;
    });

  return { items, ...paginationMeta(page, perPage, total) };
}

export async function getPublicProfessionalBySlug(slug: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { slug },
    select: {
      ...PUBLIC_PROFILE_SELECT,
      areas: { orderBy: [{ isPrimary: "desc" }, { city: "asc" }], take: 12 },
      portfolio: {
        where: { isPublic: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 12,
      },
      services: {
        where: { status: "PUBLISHED" },
        orderBy: [{ isFeatured: "desc" }, { ratingAverage: "desc" }, { createdAt: "desc" }],
        include: {
          category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
        take: 24,
      },
    },
  });

  if (!profile) throw notFound("Professional not found.");
  // A suspended or rejected professional is not publicly listable, but the
  // profile owner and admins still reach it through their own dashboards.
  if (profile.user.id && (profile.verificationStatus === "SUSPENDED")) throw notFound("Professional not found.");
  return profile;
}

export async function getPublicProfessionalById(id: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id },
    select: { ...PUBLIC_PROFILE_SELECT },
  });
  if (!profile) throw notFound("Professional not found.");
  return profile;
}

/** Lightweight lookup used by offer/booking cards. */
export async function getProfessionalSummary(professionalProfileId: string) {
  return prisma.professionalProfile.findUnique({
    where: { id: professionalProfileId },
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
      user: { select: { id: true, identity: { select: { fullName: true } } } },
    },
  });
}

export async function featuredProfessionals(limit = 6, city?: string) {
  const resolvedCity = resolveCityInput(city ?? null);
  const rows = await prisma.professionalProfile.findMany({
    where: {
      verificationStatus: "VERIFIED",
      user: { status: "ACTIVE", deletedAt: null },
      ...(resolvedCity ? { OR: [{ city: resolvedCity }, { areas: { some: { city: resolvedCity } } }] } : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { ratingAverage: "desc" }, { completedJobs: "desc" }],
    take: limit,
    select: {
      ...PUBLIC_PROFILE_SELECT,
      services: {
        where: { status: "PUBLISHED" },
        select: { category: { select: { id: true, slug: true, name: true, icon: true } } },
        distinct: ["categoryId"],
        take: 3,
      },
    },
  });
  return rows.map((row) => toCard(row));
}

// ─── Owner-scoped reads/writes ───────────────────────────────────────────────

export async function getOwnProfessionalProfile(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    include: {
      areas: true,
      documents: { orderBy: { createdAt: "desc" } },
      user: { select: { id: true, email: true, phone: true, status: true, emailVerified: true, identity: true } },
      _count: { select: { services: true, reviews: true } },
    },
  });
  if (!profile) throw notFound("Professional profile not found.");
  return profile;
}

export interface UpdateProfessionalProfileInput {
  businessName?: string | null;
  headline?: string | null;
  about?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  city?: string;
  neighborhood?: string | null;
  serviceRadiusKm?: number;
  yearsExperience?: number;
  languages?: string[];
  website?: string | null;
  phonePublic?: boolean;
  publicPhone?: string | null;
  availabilityStatus?: AvailabilityStatus;
  availability?: Prisma.InputJsonValue | null;
  acceptsUrgentJobs?: boolean;
}

export async function updateProfessionalProfile(userId: string, input: UpdateProfessionalProfileInput) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId }, select: { id: true, city: true } });
  if (!profile) throw notFound("Professional profile not found.");

  const data: Prisma.ProfessionalProfileUpdateInput = {};
  if (input.businessName !== undefined) data.businessName = input.businessName;
  if (input.headline !== undefined) data.headline = input.headline;
  if (input.about !== undefined) data.about = input.about;
  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.coverUrl !== undefined) data.coverUrl = input.coverUrl;
  if (input.city !== undefined) data.city = resolveCityInput(input.city) ?? input.city;
  if (input.neighborhood !== undefined) data.neighborhood = input.neighborhood;
  if (input.serviceRadiusKm !== undefined) data.serviceRadiusKm = input.serviceRadiusKm;
  if (input.yearsExperience !== undefined) data.yearsExperience = input.yearsExperience;
  if (input.languages !== undefined) data.languages = input.languages;
  if (input.website !== undefined) data.website = input.website;
  if (input.phonePublic !== undefined) data.phonePublic = input.phonePublic;
  if (input.publicPhone !== undefined) data.publicPhone = input.publicPhone;
  if (input.availabilityStatus !== undefined) data.availabilityStatus = input.availabilityStatus;
    if (input.availability !== undefined) {
      // Prisma needs `Prisma.JsonNull` — not JS null — to store a JSON null.
      data.availability =
        input.availability === null ? Prisma.JsonNull : (input.availability as Prisma.InputJsonValue);
    }
  if (input.acceptsUrgentJobs !== undefined) data.acceptsUrgentJobs = input.acceptsUrgentJobs;

  const [updated] = await prisma.$transaction([
    prisma.professionalProfile.update({ where: { id: profile.id }, data }),
    // Keep the primary service area aligned with the profile city.
    ...(input.city
      ? [
          prisma.serviceArea.updateMany({
            where: { professionalId: profile.id, isPrimary: true },
            data: { city: resolveCityInput(input.city) ?? input.city },
          }),
        ]
      : []),
  ]);
  return updated;
}

export async function setProfessionalAvailability(userId: string, availabilityStatus: AvailabilityStatus) {
  const profile = await prisma.professionalProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw notFound("Professional profile not found.");
  return prisma.professionalProfile.update({ where: { id: profile.id }, data: { availabilityStatus } });
}

/**
 * Recomputes the denormalised reputation counters from the review table.
 * Called inside the same transaction that writes a review so the directory
 * never shows a stale average.
 */
export async function recomputeProfessionalStats(professionalProfileId: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
  const aggregate = await client.review.aggregate({
    where: { professionalId: professionalProfileId, status: "PUBLISHED" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const jobs = await client.booking.groupBy({
    by: ["status"],
    where: { professionalId: (await client.professionalProfile.findUnique({ where: { id: professionalProfileId }, select: { userId: true } }))?.userId ?? "" },
    _count: { _all: true },
  });
  const completed = jobs.find((j) => j.status === "COMPLETED")?._count._all ?? 0;
  const cancelled = jobs.find((j) => j.status === "CANCELLED")?._count._all ?? 0;

  const ratingAverage = aggregate._avg.rating ?? 0;
  return client.professionalProfile.update({
    where: { id: professionalProfileId },
    data: {
      ratingAverage: Math.round(ratingAverage * 100) / 100,
      ratingCount: aggregate._count._all,
      completedJobs: completed,
      cancelledJobs: cancelled,
    },
  });
}

/** Response rate + median reply time, derived from offer/message history. */
export async function recomputeResponseStats(professionalProfileId: string, userId: string) {
  const [offers, repliedOffers] = await Promise.all([
    prisma.offer.count({ where: { professionalProfileId } }),
    prisma.offer.count({ where: { professionalProfileId, respondedAt: { not: null } } }),
  ]);
  const responseRate = offers === 0 ? 100 : Math.round((repliedOffers / offers) * 100);

  const recentOffers = await prisma.offer.findMany({
    where: { professionalId: userId, createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90) } },
    select: { createdAt: true, respondedAt: true },
    take: 50,
  });
  const deltas = recentOffers
    .filter((o) => o.respondedAt)
    .map((o) => (o.respondedAt!.getTime() - o.createdAt.getTime()) / 60000)
    .sort((a, b) => a - b);
  const median = deltas.length ? deltas[Math.floor(deltas.length / 2)]! : 60;

  return prisma.professionalProfile.update({
    where: { id: professionalProfileId },
    data: { responseRate, responseTimeMin: Math.max(1, Math.round(median)) },
  });
}
