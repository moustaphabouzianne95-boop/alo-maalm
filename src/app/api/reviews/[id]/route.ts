import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getReview, updateReview, createReviewSchema, markReviewHelpful } from "@/server/reviews/service";

const patchSchema = createReviewSchema.partial();

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH", "POST"], auth: [], bodySchema: patchSchema.optional(), rateLimit: "api" },
  async ({ params, body, req, user }) => {
    if (req.method === "GET") return ok(await getReview(user, params.id!));
    // POST on an existing review = the "helpful" vote.
    if (req.method === "POST") return ok(await markReviewHelpful(params.id!));
    return ok(await updateReview(user, params.id!, body ?? {}));
  }
);
