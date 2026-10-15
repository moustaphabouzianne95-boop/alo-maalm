import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { markNotificationRead } from "@/server/notifications/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: false },
  async ({ params, user }) => ok(await markNotificationRead(user!.id, params.id!))
);
