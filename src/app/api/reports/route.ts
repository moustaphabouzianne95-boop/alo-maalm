import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { createReportSchema, createReport, listReports } from "@/server/reports/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST"],
    auth: [],
    bodySchema: createReportSchema.optional(),
    rateLimit: RATE_LIMIT_BUCKETS.api,
    rateLimitMax: 20,
  },
  async ({ body, req, user }) => {
    if (req.method === "POST") return created(await createReport(user!.id, body!));
    // The full report queue is admin-only; customers see their own filings.
    const isAdmin = user!.role === "ADMIN";
    const result = await listReports({ scope: isAdmin ? "admin" : "mine", reporterId: user!.id, perPage: 25 });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
