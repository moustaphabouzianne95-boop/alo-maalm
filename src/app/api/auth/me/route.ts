import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getSession } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/server/notifications/service";
import { unreadMessageCount } from "@/server/messaging/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: [], rateLimit: false },
  async ({ user }) => {
    const session = await getSession();
    const [notifications, messages] = await Promise.all([
      unreadNotificationCount(user!.id),
      unreadMessageCount(user!.id),
    ]);
    return ok({ user: session?.user ?? user, unreadNotifications: notifications, unreadMessages: messages });
  }
);
