import { prisma } from "@/lib/db/prisma";
import { bookingCounts, nextBooking } from "@/server/bookings/service";
import { listOffers } from "@/server/offers/service";
import { listRequests } from "@/server/requests/service";
import { reviewableBookings } from "@/server/reviews/service";

/**
 * Read models for the customer dashboard (§21).
 *
 * One round of parallel queries feeds the overview page: KPI counters, the
 * next booking, the freshest requests, pending offers awaiting a decision and
 * completed jobs still waiting for a review. Everything is scoped by
 * `customerId` — ownership is enforced here, never in the UI.
 */
export async function customerOverview(userId: string) {
  const [openRequests, pendingOfferCount, counts, upcoming, recent, offersPreview, reviewable] =
    await Promise.all([
      prisma.serviceRequest.count({
        where: { customerId: userId, status: { in: ["OPEN", "RECEIVING_OFFERS"] } },
      }),
      prisma.offer.count({
        where: { status: "PENDING", request: { customerId: userId } },
      }),
      bookingCounts(userId, "CUSTOMER"),
      nextBooking(userId, "CUSTOMER"),
      listRequests({ scope: "customer", actorId: userId, page: 1, perPage: 5 }),
      listOffers({ actorId: userId, scope: "received", status: "PENDING", page: 1, perPage: 3 }),
      reviewableBookings(userId),
    ]);

  return {
    stats: {
      openRequests,
      pendingOffers: pendingOfferCount,
      upcomingBookings: counts.upcoming,
      activeBookings: counts.active,
      completedServices: counts.completed,
    },
    nextBooking: upcoming,
    recentRequests: recent,
    pendingOffers: offersPreview,
    reviewable,
  };
}

export type CustomerOverview = Awaited<ReturnType<typeof customerOverview>>;
