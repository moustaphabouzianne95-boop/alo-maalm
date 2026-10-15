import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { removeFavorite } from "@/server/favorites/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["DELETE"], auth: [], rateLimit: "api" },
  async ({ params, user }) => ok(await removeFavorite(user!.id, params.id!))
);
