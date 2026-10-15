import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { updateProfileSchema, getOwnAccount, updateOwnProfile } from "@/server/users/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH"], auth: [], bodySchema: updateProfileSchema.optional(), rateLimit: "api" },
  async ({ body, req, user }) => {
    if (req.method === "GET") return ok(await getOwnAccount(user!.id));
    await updateOwnProfile(user!.id, body ?? {});
    return ok(await getOwnAccount(user!.id));
  }
);
