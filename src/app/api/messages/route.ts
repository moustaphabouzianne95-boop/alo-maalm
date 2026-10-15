import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { listConversationsQuery } from "@/lib/api/queries";
import { listConversations, startConversationSchema, startConversation } from "@/server/messaging/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  {
    methods: ["GET", "POST"],
    auth: [],
    querySchema: listConversationsQuery,
    bodySchema: startConversationSchema.optional(),
    rateLimit: "message",
  },
  async ({ query, body, req, user }) => {
    if (req.method === "POST") return created(await startConversation(user, body!));
    const result = await listConversations({
      actorId: user!.id,
      search: query.search,
      unreadOnly: query.unread,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
