import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { verifyEmail } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

const verifySchema = z.object({ token: z.string().trim().min(20, "invalid_token").max(200) });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["POST"],
    auth: null,
    bodySchema: verifySchema,
    rateLimit: RATE_LIMIT_BUCKETS.auth,
    rateLimitMax: 10,
  },
  async ({ body }) => ok(await verifyEmail(body.token))
);
