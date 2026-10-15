import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { passwordSchema } from "@/lib/validation/common";
import { resetPassword } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().trim().min(20, "invalid_token").max(200),
  password: passwordSchema,
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["POST"],
    auth: null,
    bodySchema: schema,
    rateLimit: RATE_LIMIT_BUCKETS.auth,
    rateLimitMax: 8,
  },
  async ({ body }) => ok(await resetPassword(body.token, body.password))
);
