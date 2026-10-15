import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { markAllNotificationsRead } from "@/server/notifications/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: false },
  async ({ user }) => ok(await markAllNotificationsRead(user!.id))
);
