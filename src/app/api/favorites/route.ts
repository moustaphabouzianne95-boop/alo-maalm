import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listFavoritesQuery } from "@/lib/api/queries";
import { favoriteSchema, toggleFavorite, listFavorites, countFavorites } from "@/server/favorites/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "POST"], auth: [], querySchema: listFavoritesQuery, bodySchema: favoriteSchema.optional(), rateLimit: "api" },
  async ({ query, body, req, user }) => {
    if (req.method === "POST") return ok(await toggleFavorite(user!.id, body!));
    const result = await listFavorites(user!.id, {
      targetType: query.targetType,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    const counts = await countFavorites(user!.id);
    return ok(items, { meta: { ...meta, counts } as Record<string, unknown> });
  }
);
