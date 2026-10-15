import { withApi } from "@/lib/api/with-api";
import { ok, created } from "@/lib/api/respond";
import { listOffersForRequest } from "@/server/offers/service";
import { createOfferSchema, createOffer } from "@/server/offers/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "POST"], auth: [], bodySchema: createOfferSchema.optional(), rateLimit: "api" },
  async ({ params, body, req, user }) => {
    if (req.method === "GET") return ok(await listOffersForRequest(user, params.id!));
    return created(await createOffer(user, params.id!, body!));
  }
);
