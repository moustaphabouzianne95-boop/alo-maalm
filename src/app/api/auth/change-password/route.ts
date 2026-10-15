import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { passwordSchema } from "@/lib/validation/common";
import { changePassword } from "@/server/auth/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

const schema = z.object({
  currentPassword: z.string().min(1, "current_password_required").max(200),
  newPassword: passwordSchema,
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["POST"],
    auth: [],
    bodySchema: schema,
    rateLimit: RATE_LIMIT_BUCKETS.auth,
    rateLimitMax: 6,
  },
  async ({ body, user }) => ok(await changePassword(user!.id, body.currentPassword, body.newPassword))
);
