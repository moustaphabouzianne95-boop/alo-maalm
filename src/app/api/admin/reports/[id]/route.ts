import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getReport, updateReportStatus, assignReport } from "@/server/reports/service";

const patchSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]).optional(),
  resolution: z.string().trim().max(1000).nullable().optional(),
  actionTaken: z.string().trim().max(200).nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH"], auth: ["ADMIN"], bodySchema: patchSchema.optional(), rateLimit: false },
  async ({ params, body, req, user }) => {
    if (req.method === "GET") return ok(await getReport(params.id!));
    const input = body ?? {};
    if (input.assignedToId !== undefined) {
      return ok(await assignReport(user!.id, params.id!, input.assignedToId));
    }
    if (!input.status) return ok(await getReport(params.id!));
    return ok(
      await updateReportStatus(user!.id, params.id!, input.status, {
        resolution: input.resolution ?? null,
        actionTaken: input.actionTaken ?? null,
      })
    );
  }
);
