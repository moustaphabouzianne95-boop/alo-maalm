import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { unhideService } from "@/server/services/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["ADMIN"], rateLimit: false },
  async ({ params, user }) => ok(await unhideService(user!.id, params.id!))
);
