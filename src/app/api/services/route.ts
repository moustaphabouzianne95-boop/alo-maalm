import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { unauthenticated } from "@/lib/api/errors";
import { listServicesQuery } from "@/lib/api/queries";
import { listServices, servicePriceBounds, createService, createServiceSchema } from "@/server/services/service";
import { getSession } from "@/lib/auth/session";

/**
 * `GET` is public discovery; `POST` creates a service and therefore needs a
 * professional session. The route is declared public so the discovery call
 * never 401s, and authorisation for the write is enforced explicitly here and
 * again inside `createService` — hiding it behind `auth: []` would break `GET`.
 */
export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST"],
    auth: null,
    querySchema: listServicesQuery,
    bodySchema: createServiceSchema.optional(),
    rateLimit: "api",
  },
  async ({ query, body, req }) => {
    if (req.method === "POST") {
      const session = await getSession();
      if (!session) throw unauthenticated();
      return created(await createService(session.user, body!));
    }

    const [result, bounds] = await Promise.all([
      listServices({
        search: query.search,
        categorySlug: query.category,
        city: query.city,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        minRating: query.minRating,
        verifiedOnly: query.verified,
        availability: query.availability,
        urgentOnly: query.urgent,
        professionalId: query.professionalId,
        sort: query.sort,
        page: query.page,
        perPage: query.perPage,
      }),
      servicePriceBounds({ categorySlug: query.category, city: query.city, search: query.search }),
    ]);
    const { items, ...meta } = result;
    return ok(items, { meta: { ...meta, priceBounds: bounds } as Record<string, unknown> });
  }
);
