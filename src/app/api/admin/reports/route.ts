import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listReportsQuery } from "@/lib/api/queries";
import { listReports } from "@/server/reports/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: listReportsQuery, rateLimit: false },
  async ({ query }) => {
    const result = await listReports({
      scope: "admin",
      status: query.status,
      reason: query.reason,
      targetType: query.targetType,
      search: query.search,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
