import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { deactivateOwnAccount } from "@/server/users/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: RATE_LIMIT_BUCKETS.auth, rateLimitMax: 3 },
  async ({ user }) => ok(await deactivateOwnAccount(user!.id))
);
