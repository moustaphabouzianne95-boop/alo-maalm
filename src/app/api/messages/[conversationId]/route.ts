import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { listMessagesQuery } from "@/lib/api/queries";
import {
  getConversation,
  listMessages,
  sendMessageSchema,
  postMessage,
  archiveConversation,
} from "@/server/messaging/service";
import { RATE_LIMIT_BUCKETS } from "@/lib/rate-limit";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST", "DELETE"],
    auth: [],
    querySchema: listMessagesQuery,
    bodySchema: sendMessageSchema.optional(),
    rateLimit: RATE_LIMIT_BUCKETS.message,
    rateLimitMax: 40,
  },
  async ({ params, query, body, req, user }) => {
    const conversationId = params.conversationId!;
    if (req.method === "GET") {
      const [conversation, messages] = await Promise.all([
        getConversation(user, conversationId),
        listMessages({ conversationId, actorId: user!.id, before: query.before, page: query.page, perPage: query.perPage }),
      ]);
      const { items, ...meta } = messages;
      return ok({ conversation, messages: items }, { meta: meta as Record<string, unknown> });
    }
    if (req.method === "POST") return created(await postMessage(user, conversationId, body!));
    return ok(await archiveConversation(user, conversationId));
  }
);
