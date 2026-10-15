import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listReviewsQuery } from "@/lib/api/queries";
import { listReviews, listMyReviews, reviewableBookings } from "@/server/reviews/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, querySchema: listReviewsQuery, rateLimit: "api" },
  async ({ query, req }) => {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();

    // `?mine=1` on an authenticated customer request lists their own reviews
    // and the completed jobs still waiting for one.
    if (query.all && session?.user.role === "CUSTOMER") {
      const [reviews, pending] = await Promise.all([listMyReviews(session.user.id, { page: query.page, perPage: query.perPage }), reviewableBookings(session.user.id)]);
      const { items, ...meta } = reviews;
      return ok(items, { meta: { ...meta, reviewableBookings: pending } as Record<string, unknown> });
    }
    void req;

    const result = await listReviews({
      professionalId: query.professionalId,
      serviceId: query.serviceId,
      rating: query.rating,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
