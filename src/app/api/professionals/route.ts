import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listProfessionalsQuery } from "@/lib/api/queries";
import { listProfessionals } from "@/server/professionals/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, querySchema: listProfessionalsQuery, rateLimit: "api" },
  async ({ query }) => {
    const result = await listProfessionals({
      search: query.search,
      categorySlug: query.category,
      city: query.city,
      verifiedOnly: query.verified,
      availability: query.availability,
      minRating: query.minRating,
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
