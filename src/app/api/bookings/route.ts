import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import { listBookingsQuery } from "@/lib/api/queries";
import { listBookings, bookingActorRole, nextBooking, bookingCounts } from "@/server/bookings/service";

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: [], querySchema: listBookingsQuery, rateLimit: "api" },
  async ({ query, user }) => {
    const role = bookingActorRole(user, { customerId: user!.id, professionalId: user!.id }) ?? "CUSTOMER";
    // Admins see everything; the actor role drives which side of the join runs.
    const effectiveRole = user!.role === "ADMIN" && query.tab === "all" ? role : role;
    const result = await listBookings({
      actorId: user!.id,
      role: effectiveRole,
      tab: query.tab,
      status: query.status,
      search: query.search,
      city: query.city,
      page: query.page,
      perPage: query.perPage,
    });
    const { items, ...meta } = result;
    const [counts, upcoming] = await Promise.all([
      bookingCounts(user!.id, role === "ADMIN" ? "CUSTOMER" : role),
      nextBooking(user!.id, role === "ADMIN" ? "CUSTOMER" : role),
    ]);
    return ok(items, { meta: { ...meta, counts, upcoming: upcoming?.reference ?? null } as Record<string, unknown> });
  }
);
