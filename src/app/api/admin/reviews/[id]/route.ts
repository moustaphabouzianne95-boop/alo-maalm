import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { setReviewStatus, deleteReview } from "@/server/reviews/service";

const patchSchema = z.object({
  status: z.enum(["PUBLISHED", "HIDDEN", "UNDER_REVIEW"]).optional(),
  reason: z.string().trim().max(500).optional().nullable(),
  delete: z.coerce.boolean().optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["PATCH", "DELETE"], auth: ["ADMIN"], bodySchema: patchSchema.optional(), rateLimit: false },
  async ({ params, body, req, user }) => {
    if (req.method === "DELETE") return ok(await deleteReview(user!.id, params.id!, body?.reason ?? "Removed by moderation"));
    if (body?.delete) return ok(await deleteReview(user!.id, params.id!, body.reason ?? "Removed by moderation"));
    return ok(await setReviewStatus(user!.id, params.id!, body?.status ?? "PUBLISHED", body?.reason ?? undefined));
  }
);
