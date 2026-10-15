import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listReviewsQuery } from "@/lib/api/queries";
import { listReviews } from "@/server/reviews/service";
import { getServicePublic } from "@/server/services/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, querySchema: listReviewsQuery, rateLimit: "api" },
  async ({ params, query }) => {
    // Resolve the public slug/uuid to an id so the review filter is exact.
    const service = await getServicePublic(params.id!);
    const result = await listReviews({
      serviceId: service.id,
      rating: query.rating,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
