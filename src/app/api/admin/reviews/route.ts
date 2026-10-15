import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { paginationSchema, paginationMeta } from "@/lib/validation/common";
import { prisma } from "@/lib/db/prisma";

const query = paginationSchema.extend({
  status: z.enum(["PUBLISHED", "HIDDEN", "UNDER_REVIEW"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().trim().max(160).optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: query, rateLimit: false },
  async ({ query: q }) => {
    const where = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.rating ? { rating: q.rating } : {}),
      ...(q.search
        ? {
            OR: [
              { comment: { contains: q.search, mode: "insensitive" as const } },
              { author: { identity: { fullName: { contains: q.search, mode: "insensitive" as const } } } },
              { booking: { reference: { contains: q.search.toUpperCase() } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          author: { select: { id: true, identity: { select: { fullName: true } } } },
          professional: { select: { id: true, slug: true, businessName: true, userId: true } },
          booking: { select: { id: true, reference: true, title: true, price: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);
    return ok(items, { meta: paginationMeta(q.page, q.perPage, total) as Record<string, unknown> });
  }
);
