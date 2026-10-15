import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { emailSchema } from "@/lib/validation/common";
import { requestPasswordReset } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

const schema = z.object({ email: emailSchema });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["POST"],
    auth: null,
    bodySchema: schema,
    rateLimit: RATE_LIMIT_BUCKETS.auth,
    rateLimitMax: 5,
  },
  async ({ body }) => ok(await requestPasswordReset(body.email))
);
