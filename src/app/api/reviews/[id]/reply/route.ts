import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { replyToReview } from "@/server/reviews/service";

const schema = z.object({ reply: z.string().trim().min(3, "reply_too_short").max(1000, "reply_too_long") });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["PROFESSIONAL", "ADMIN"], bodySchema: schema, rateLimit: "api" },
  async ({ params, body, user }) => ok(await replyToReview(user, params.id!, body.reply))
);
