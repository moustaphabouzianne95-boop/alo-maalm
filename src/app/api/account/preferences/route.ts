import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { notificationPreferencesSchema, updateNotificationPreferences } from "@/server/users/service";

/**
 * Notification channel preferences (§18). Delivery channels are recorded now
 * so email/WhatsApp/push can be layered on later without a schema change.
 */
export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["PATCH"], auth: [], bodySchema: notificationPreferencesSchema, rateLimit: "api" },
  async ({ body, user }) => ok(await updateNotificationPreferences(user!.id, body))
);
