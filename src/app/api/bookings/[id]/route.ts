import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { getBooking, updateBookingDetails, patchBookingSchema } from "@/server/bookings/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET", "PATCH"], auth: [], bodySchema: patchBookingSchema.optional(), rateLimit: "api" },
  async ({ params, body, req, user }) => {
    if (req.method === "GET") return ok(await getBooking(user, params.id!));
    return ok(await updateBookingDetails(user, params.id!, body ?? {}));
  }
);
