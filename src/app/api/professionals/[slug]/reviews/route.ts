import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listReviewsQuery } from "@/lib/api/queries";
import { listReviews } from "@/server/reviews/service";
import { getPublicProfessionalBySlug } from "@/server/professionals/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, querySchema: listReviewsQuery, rateLimit: "api" },
  async ({ params, query }) => {
    const profile = await getPublicProfessionalBySlug(params.slug!);
    const result = await listReviews({
      professionalId: profile.id,
      rating: query.rating,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
