import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { paginationSchema, paginationMeta } from "@/lib/validation/common";
import { prisma } from "@/lib/db/prisma";

const query = paginationSchema.extend({
  status: z.enum(["DRAFT", "PUBLISHED", "PAUSED", "HIDDEN"]).optional(),
  search: z.string().trim().max(160).optional(),
  category: z.string().trim().max(80).optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: query, rateLimit: false },
  async ({ query: q }) => {
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: { slug: q.category } } : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: "insensitive" as const } },
              { slug: { contains: q.search, mode: "insensitive" as const } },
              { professional: { businessName: { contains: q.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.service.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          category: { select: { id: true, slug: true, name: true, icon: true } },
          professional: {
            select: {
              id: true,
              slug: true,
              businessName: true,
              verificationStatus: true,
              user: { select: { id: true, email: true, identity: { select: { fullName: true } } } },
            },
          },
          // Reports are polymorphic (no FK back to services), so the moderation
          // queue is joined in `admin/reports` instead of counted here.
          _count: { select: { reviews: true, requests: true, bookings: true } },
        },
      }),
      prisma.service.count({ where }),
    ]);
    return ok(items, { meta: paginationMeta(q.page, q.perPage, total) as Record<string, unknown> });
  }
);
