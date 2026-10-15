import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listOffersQuery } from "@/lib/api/queries";
import { listOffers } from "@/server/offers/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: [], querySchema: listOffersQuery, rateLimit: "api" },
  async ({ query, user }) => {
    const result = await listOffers({
      actorId: user!.id,
      scope: query.scope,
      status: query.status,
      search: query.search,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
