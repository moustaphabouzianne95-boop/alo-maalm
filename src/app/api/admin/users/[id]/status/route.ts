import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { setUserStatus } from "@/server/users/service";

const schema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "SUSPENDED", "DEACTIVATED"]),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], bodySchema: schema, rateLimit: false },
  async ({ params, body, user }) => ok(await setUserStatus(user!.id, params.id!, body.status, { reason: body.reason ?? null }))
);
