import { withApi } from "@/lib/api/with-api";
import { created } from "@/lib/api/respond";
import { createReviewSchema, createReviewForBooking } from "@/server/reviews/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["POST"], auth: ["CUSTOMER", "ADMIN"], bodySchema: createReviewSchema, rateLimit: "api" },
  async ({ params, body, user }) => created(await createReviewForBooking(user, params.id!, body))
);
