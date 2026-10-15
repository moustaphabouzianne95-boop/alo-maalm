import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { setProfessionalVerification } from "@/server/users/service";

const schema = z.object({
  verificationStatus: z.enum(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"]),
  reason: z.string().trim().max(500).optional().nullable(),
  method: z.enum(["MANUAL", "PHONE", "EMAIL"]).optional(),
});

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], bodySchema: schema, rateLimit: false },
  async ({ params, body, user }) =>
    ok(
      await setProfessionalVerification(user!.id, params.id!, body.verificationStatus, {
        reason: body.reason ?? null,
        method: body.method,
      })
    )
);
