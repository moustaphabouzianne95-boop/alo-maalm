import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { logoutUser } from "@/server/auth/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: [], rateLimit: false },
  async () => ok(await logoutUser())
);
