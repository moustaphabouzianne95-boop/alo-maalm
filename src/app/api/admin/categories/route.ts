import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { listCategoriesQuery } from "@/lib/api/queries";
import { z } from "zod";
import { listCategories, createCategory } from "@/server/categories/service";

const bodySchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2, "name_required").max(80),
  nameFr: z.string().trim().max(80).nullable().optional(),
  nameEn: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  descriptionFr: z.string().trim().max(1000).nullable().optional(),
  descriptionEn: z.string().trim().max(1000).nullable().optional(),
  icon: z.string().trim().max(60).optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "invalid_color").optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST"],
    auth: ["ADMIN"],
    querySchema: listCategoriesQuery,
    bodySchema: bodySchema.optional(),
    rateLimit: false,
  },
  async ({ query, body, req }) => {
    if (req.method === "POST") return created(await createCategory(body!));
    const result = await listCategories({ activeOnly: false, search: query.search, page: query.page, perPage: 100 });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
