import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { unauthenticated } from "@/lib/api/errors";
import { listRequestsQuery } from "@/lib/api/queries";
import { createRequestSchema, createRequest, listRequests } from "@/server/requests/service";
import { getSession } from "@/lib/auth/session";

/**
 * `GET` serves three audiences from one endpoint (§12):
 *   • anonymous  → open demand in a city/category (the public job board)
 *   • customer   → their own requests
 *   • professional → demand they can serve plus their own offers
 * The scope is derived from the session, never from a query parameter.
 */
export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST"],
    auth: null,
    querySchema: listRequestsQuery,
    bodySchema: createRequestSchema.optional(),
    rateLimit: "api",
  },
  async ({ query, body, req }) => {
    const session = await getSession();

    if (req.method === "POST") {
      if (!session) throw unauthenticated();
      return created(await createRequest(session.user, body!));
    }

    // Anonymous visitors get the public job board: demand that still accepts
    // offers, scoped by the URL filters. The scope is derived from the session,
    // never from a query parameter.
    const scope: "customer" | "professional" | "admin" = !session
      ? "professional"
      : session.user.role === "CUSTOMER"
        ? "customer"
        : session.user.role === "PROFESSIONAL"
          ? "professional"
          : "admin";

    const result = await listRequests({
      scope,
      actorId: session?.user.id,
      status: session ? query.status : (query.status ?? "OPEN"),
      search: query.search,
      city: query.city,
      categorySlug: query.category,
      urgency: query.urgency,
      minBudget: query.minBudget,
      maxBudget: query.maxBudget,
      matchedOnly: query.matched,
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, offeredRequestIds, ...meta } = result;
    return ok(items, { meta: { ...meta, offeredRequestIds } as Record<string, unknown> });
  }
);
