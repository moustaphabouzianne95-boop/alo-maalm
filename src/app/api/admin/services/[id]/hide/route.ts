import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { hideService } from "@/server/services/service";

const schema = z.object({ reason: z.string().trim().max(500).optional().nullable() });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], bodySchema: schema, rateLimit: false },
  async ({ params, body, user }) => ok(await hideService(user!.id, params.id!, body.reason ?? undefined))
);
