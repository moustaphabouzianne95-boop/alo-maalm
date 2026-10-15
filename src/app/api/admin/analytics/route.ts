import { z } from "zod";
import { withApi } from "@/lib/api/with-api";
import { ok } from "@/lib/api/respond";
import {
  platformOverview,
  popularCategories,
  topCities,
  ratingDistribution,
  usersSeries,
  requestsSeries,
  bookingsSeries,
  completedBookingsSeries,
  revenueSeries,
} from "@/server/analytics/service";

const query = z.object({ months: z.coerce.number().int().min(3).max(24).default(6) });

export const { GET, POST, PATCH, PUT, DELETE } = withApi(
  { methods: ["GET"], auth: ["ADMIN"], querySchema: query, rateLimit: false },
  async ({ query: q }) => {
    const [overview, categories, cities, ratings, users, requests, bookings, completed, revenue] = await Promise.all([
      platformOverview(),
      popularCategories(10),
      topCities(10),
      ratingDistribution(),
      usersSeries(q.months),
      requestsSeries(q.months),
      bookingsSeries(q.months),
      completedBookingsSeries(q.months),
      revenueSeries(q.months),
    ]);
    return ok({ overview, categories, cities, ratings, series: { users, requests, bookings, completed, revenue } });
  }
);
