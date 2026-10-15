import type { Prisma, FavoriteTargetType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput } from "@/lib/validation/common";
import { CARD_INCLUDE } from "@/server/services/service";
import { PUBLIC_PROFILE_SELECT } from "@/server/professionals/service";

/**
 * Favorites (§20) — customers save services and professionals.
 *
 * `toggle` is idempotent, which is what makes optimistic UI safe: a retried
 * request converges on the same server state instead of flipping twice.
 */

export const favoriteSchema = z.object({
  targetType: z.enum(["SERVICE", "PROFESSIONAL"]),
  targetId: z.string().uuid("invalid_id"),
});

export type FavoriteInput = z.infer<typeof favoriteSchema>;

// Favourite rows render through the *same* cards as the public catalogue
// (`ServiceCard`, `ProfessionalCard`), so the reads reuse the catalogue's
// include/select shapes instead of a narrower projection that would force the
// UI to fork into a second, subtly different card.
const FAVORITE_PROFESSIONAL_SELECT = {
  ...PUBLIC_PROFILE_SELECT,
  services: {
    where: { status: "PUBLISHED" as const },
    select: { category: { select: { id: true, slug: true, name: true, icon: true } } },
    distinct: ["categoryId" as const],
    take: 4,
  },
} as const satisfies Prisma.ProfessionalProfileSelect;

export async function toggleFavorite(userId: string, input: FavoriteInput) {
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_targetType_targetId: {
        userId,
        targetType: input.targetType as FavoriteTargetType,
        targetId: input.targetId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { favorited: false as const, id: existing.id };
  }

  // Validate the target exists and is publicly listable before saving it.
  if (input.targetType === "SERVICE") {
    const service = await prisma.service.findUnique({
      where: { id: input.targetId },
      select: { id: true, status: true, professional: { select: { user: { select: { status: true } } } } },
    });
    if (!service || service.status !== "PUBLISHED") throw notFound("Service not found.");
    if (service.professional.user.status !== "ACTIVE") throw notFound("Service not found.");
  } else {
    const profile = await prisma.professionalProfile.findUnique({
      where: { id: input.targetId },
      select: { id: true, verificationStatus: true, user: { select: { status: true, deletedAt: true } } },
    });
    if (!profile || profile.user.deletedAt || profile.user.status !== "ACTIVE") {
      throw notFound("Professional not found.");
    }
    if (profile.verificationStatus === "SUSPENDED") throw notFound("Professional not found.");
  }

  const created = await prisma.favorite.create({
    data: { userId, targetType: input.targetType as FavoriteTargetType, targetId: input.targetId },
    select: { id: true },
  });
  return { favorited: true as const, id: created.id };
}

export async function removeFavorite(userId: string, id: string) {
  const favorite = await prisma.favorite.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!favorite) throw notFound("Favorite not found.");
  if (favorite.userId !== userId) throw forbidden();
  await prisma.favorite.delete({ where: { id } });
  return { id, removed: true };
}

export async function listFavorites(
  userId: string,
  input: Partial<PaginationInput> & { targetType?: FavoriteTargetType } = {}
) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 12));
  const where: Prisma.FavoriteWhereInput = {
    userId,
    ...(input.targetType ? { targetType: input.targetType } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.favorite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.favorite.count({ where }),
  ]);

  // Resolve both polymorphic targets with exactly two queries (no N+1).
  const serviceIds = rows.filter((r) => r.targetType === "SERVICE").map((r) => r.targetId);
  const professionalIds = rows.filter((r) => r.targetType === "PROFESSIONAL").map((r) => r.targetId);

  const [services, professionals] = await Promise.all([
    serviceIds.length
      ? prisma.service.findMany({ where: { id: { in: serviceIds } }, include: CARD_INCLUDE })
      : Promise.resolve([]),
    professionalIds.length
      ? prisma.professionalProfile.findMany({
          where: { id: { in: professionalIds } },
          select: FAVORITE_PROFESSIONAL_SELECT,
        })
      : Promise.resolve([]),
  ]);

  const serviceMap = new Map(services.map((s) => [s.id, s]));
  const professionalMap = new Map(professionals.map((p) => [p.id, p]));

  return {
    items: rows.map((row) => ({
      id: row.id,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt,
      service: row.targetType === "SERVICE" ? (serviceMap.get(row.targetId) ?? null) : null,
      professional: row.targetType === "PROFESSIONAL" ? (professionalMap.get(row.targetId) ?? null) : null,
    })),
    ...paginationMeta(page, perPage, total),
  };
}

/** Set of target ids the user already saved — used to pre-fill heart buttons. */
export async function favoriteIdsFor(userId: string | null | undefined, targetType?: FavoriteTargetType, ids?: string[]) {
  if (!userId) return [] as string[];
  const rows = await prisma.favorite.findMany({
    where: {
      userId,
      ...(targetType ? { targetType } : {}),
      ...(ids?.length ? { targetId: { in: ids } } : {}),
    },
    select: { targetId: true, targetType: true, id: true },
  });
  return rows.map((r) => r.targetId);
}

export async function favoriteMapFor(userId: string | null | undefined, ids: string[]) {
  if (!userId || !ids.length) return new Map<string, string>();
  const rows = await prisma.favorite.findMany({
    where: { userId, targetId: { in: ids } },
    select: { targetId: true, id: true },
  });
  return new Map(rows.map((r) => [r.targetId, r.id]));
}

export async function countFavorites(userId: string) {
  const [services, professionals] = await Promise.all([
    prisma.favorite.count({ where: { userId, targetType: "SERVICE" } }),
    prisma.favorite.count({ where: { userId, targetType: "PROFESSIONAL" } }),
  ]);
  return { services, professionals, total: services + professionals };
}

export { unprocessable };
