import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getCategoryBySlug } from "@/server/categories/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: null, rateLimit: "api" },
  async ({ params }) => ok(await getCategoryBySlug(params.slug!))
);
