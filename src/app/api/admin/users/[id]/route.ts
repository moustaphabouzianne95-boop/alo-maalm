import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getUserForAdmin } from "@/server/users/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], rateLimit: false },
  async ({ params }) => ok(await getUserForAdmin(params.id!))
);
