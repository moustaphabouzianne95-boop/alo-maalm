import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { loginUser } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";
import { homePathForRole } from "@/lib/permissions/roles";

const loginSchema = z.object({
  /** Email *or* Moroccan phone number. */
  identifier: z.string().trim().min(3, "identifier_required").max(254),
  password: z.string().min(1, "password_required").max(200),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["POST"],
    auth: null,
    bodySchema: loginSchema,
    rateLimit: RATE_LIMIT_BUCKETS.auth,
    rateLimitMax: 10,
  },
  async ({ body, req, ip }) => {
    const result = await loginUser({
      identifier: body.identifier,
      password: body.password,
      ip,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    // Telling the client where to land keeps role routing in one place.
    return ok({ ...result, redirectTo: homePathForRole(result.user.role) });
  }
);
