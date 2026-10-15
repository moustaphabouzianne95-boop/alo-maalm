import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { resendVerificationEmail } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: RATE_LIMIT_BUCKETS.auth, rateLimitMax: 5 },
  async ({ user }) => ok(await resendVerificationEmail(user!.id))
);
