import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { paginationSchema } from "@/lib/validation/common";
import { prisma } from "@/lib/db/prisma";
import { paginationMeta } from "@/lib/validation/common";

const query = paginationSchema.extend({
  verification: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]).optional(),
  city: z.string().trim().max(60).optional(),
  search: z.string().trim().max(160).optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: query, rateLimit: false },
  async ({ query: q }) => {
    const where = {
      ...(q.verification ? { verificationStatus: q.verification } : {}),
      ...(q.city ? { city: q.city } : {}),
      ...(q.search
        ? {
            OR: [
              { businessName: { contains: q.search, mode: "insensitive" as const } },
              { slug: { contains: q.search, mode: "insensitive" as const } },
              { user: { identity: { fullName: { contains: q.search, mode: "insensitive" as const } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.professionalProfile.findMany({
        where,
        orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          user: { select: { id: true, email: true, phone: true, status: true, createdAt: true, identity: { select: { fullName: true } } } },
          documents: { orderBy: { createdAt: "desc" }, take: 3 },
          areas: { take: 5 },
          _count: { select: { services: true, reviews: true } },
        },
      }),
      prisma.professionalProfile.count({ where }),
    ]);
    return ok(items, { meta: paginationMeta(q.page, q.perPage, total) as Record<string, unknown> });
  }
);
