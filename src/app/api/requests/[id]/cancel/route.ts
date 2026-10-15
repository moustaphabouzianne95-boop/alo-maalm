import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { cancelRequest } from "@/server/requests/service";

const schema = z.object({ reason: z.string().trim().max(500).optional().nullable() });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], bodySchema: schema, rateLimit: "api" },
  async ({ params, body, user }) => ok(await cancelRequest(user, params.id!, body.reason ?? undefined))
);
