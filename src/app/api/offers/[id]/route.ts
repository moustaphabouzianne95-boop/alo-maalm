import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getOffer, updateOfferSchema, updateOffer, rejectOffer } from "@/server/offers/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH", "DELETE"], auth: [], bodySchema: updateOfferSchema.optional(), rateLimit: "api" },
  async ({ params, body, req, user }) => {
    if (req.method === "GET") return ok(await getOffer(user, params.id!));
    // PATCH edits a pending offer; DELETE is the customer declining it.
    if (req.method === "PATCH") return ok(await updateOffer(user, params.id!, body!));
    return ok(await rejectOffer(user, params.id!));
  }
);
