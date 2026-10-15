import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { adminResetPassword } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], rateLimit: RATE_LIMIT_BUCKETS.auth, rateLimitMax: 10 },
  async ({ params, user }) => ok(await adminResetPassword(user!.id, params.id!))
);
