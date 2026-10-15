import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listCategoriesQuery } from "@/lib/api/queries";
import { listCategories } from "@/server/categories/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, querySchema: listCategoriesQuery, rateLimit: "api" },
  async ({ query }) => {
    const result = await listCategories({
      activeOnly: !query.all,
      search: query.search,
      page: query.page,
      perPage: Math.min(query.perPage, 100),
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
