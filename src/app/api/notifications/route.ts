import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listNotificationsQuery } from "@/lib/api/queries";
import { listNotifications } from "@/server/notifications/service";
import type { NotificationType } from "@/lib/notifications/types";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: [], querySchema: listNotificationsQuery, rateLimit: false },
  async ({ query, user }) => {
    const result = await listNotifications({
      userId: user!.id,
      unreadOnly: query.unread,
      type: query.type as NotificationType | undefined,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    return ok(items, { meta: meta as Record<string, unknown> });
  }
);
