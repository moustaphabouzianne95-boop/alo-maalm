import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { markConversationRead } from "@/server/messaging/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: false },
  async ({ params, user }) => ok(await markConversationRead(user, params.conversationId!))
);
