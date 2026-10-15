import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { withdrawOffer } from "@/server/offers/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["PROFESSIONAL", "ADMIN"], rateLimit: "api" },
  async ({ params, user }) => ok(await withdrawOffer(user, params.id!))
);
