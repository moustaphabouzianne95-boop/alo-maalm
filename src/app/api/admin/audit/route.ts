import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listAuditQuery } from "@/lib/api/queries";
import { listAuditLogs } from "@/server/users/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: listAuditQuery, rateLimit: false },
  async ({ query }) => {
    const result = await listAuditLogs({
      action: query.action,
      targetType: query.targetType,
      targetId: query.targetId,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
