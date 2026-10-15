import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { updateCategory, setCategoryActive, deleteCategory } from "@/server/categories/service";

const patchSchema = z.object({
  slug: z.string().trim().min(2).max(80).optional(),
  name: z.string().trim().min(2).max(80).optional(),
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
  { methods: ["PATCH", "POST", "DELETE"], auth: ["ADMIN"], bodySchema: patchSchema.optional(), rateLimit: false },
  async ({ params, body, req }) => {
    if (req.method === "DELETE") return ok(await deleteCategory(params.id!));
    // POST with only { isActive } is the enable/disable toggle used by the
    // moderation table's switch control.
    if (req.method === "POST" && body && Object.keys(body).length === 1 && body.isActive !== undefined) {
      return ok(await setCategoryActive(params.id!, body.isActive));
    }
    return ok(await updateCategory(params.id!, body ?? {}));
  }
);
