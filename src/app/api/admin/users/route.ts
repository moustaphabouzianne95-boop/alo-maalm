import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listUsersQuery } from "@/lib/api/queries";
import { listUsers } from "@/server/users/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: listUsersQuery, rateLimit: false },
  async ({ query }) => {
    const result = await listUsers({
      role: query.role,
      status: query.status,
      verification: query.verification,
      city: query.city,
      search: query.search,
      sort: query.sort,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
