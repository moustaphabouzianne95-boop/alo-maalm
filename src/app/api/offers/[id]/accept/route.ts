import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { acceptOffer } from "@/server/offers/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

/**
 * The transactional offer-acceptance endpoint (§15, §53). Idempotency and race
 * safety live in `acceptOffer`; this route only authenticates and forwards.
 */
export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["CUSTOMER", "ADMIN"], rateLimit: RATE_LIMIT_BUCKETS.api, rateLimitMax: 20 },
  async ({ params, user }) => ok(await acceptOffer(user, params.id!))
);
