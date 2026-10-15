import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { resetAllRateLimits } from "@/lib/rate-limit";

/**
 * Clears every rate-limit counter.
 *
 * Restricted to administrators: in production this endpoint exists so an
 * operator can unblock a whole office behind one NAT address after an incident.
 * The test harness uses it to stay repeatable.
 */
export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], rateLimit: false },
  async () => {
    await resetAllRateLimits();
    return ok({ cleared: true });
  }
);
