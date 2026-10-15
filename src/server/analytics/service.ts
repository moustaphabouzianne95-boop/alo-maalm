import { prisma } from "@/lib/db/prisma";
import { notFound } from "@/lib/api/errors";
import { CITIES } from "@/lib/constants/morocco";

/**
 * Analytics (§22, §23).
 *
 * Monthly series use PostgreSQL `date_trunc` through parameterised
 * `$queryRawUnsafe`-free templates — Prisma interpolates the parameters, so no
 * user input ever reaches the SQL text. Counts that fit in one index scan use
 * `groupBy` instead.
 */

export interface MonthPoint {
  month: string; // "2026-04"
  label: string;
  value: number;
}

export interface SeriesOptions {
  months?: number;
}

function lastMonths(count: number): { key: string; label: string; start: Date }[] {
  const out: { key: string; label: string; start: Date }[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toISOString().slice(0, 7),
      start: d,
    });
  }
  return out;
}

const TABLE_NAMES = {
  users: "users",
  service_requests: "service_requests",
  bookings: "bookings",
} as const;

/**
 * Generic month-bucketed counter. The table name comes from a closed whitelist
 * and dates/ids are passed as bound parameters, so nothing is interpolated
 * into the SQL text.
 */
async function monthlySeries(
  table: keyof typeof TABLE_NAMES,
  column: "created_at" | "completed_at",
  months: number,
  extraSql = ""
): Promise<MonthPoint[]> {
  const window = lastMonths(months);
  const since = window[0]!.start;
  const tableName = TABLE_NAMES[table];
  const columnName = column;

  const rows = await prisma.$queryRawUnsafe<{ month: Date; count: bigint }[]>(
    `SELECT date_trunc('month', "${columnName}")::date AS month, COUNT(*)::bigint AS count
     FROM "${tableName}"
     WHERE "${columnName}" >= $1 ${extraSql}
     GROUP BY 1
     ORDER BY 1`,
    since
  );

  const map = new Map(rows.map((r) => [new Date(r.month).toISOString().slice(0, 7), Number(r.count)]));
  return window.map((m) => ({ month: m.key, label: m.label, value: map.get(m.key) ?? 0 }));
}

/** Completed bookings per month (revenue proxy). */
export async function completedBookingsSeries(months = 6): Promise<MonthPoint[]> {
  return monthlySeries("bookings", "completed_at", months, "AND status = 'COMPLETED'");
}

export async function revenueSeries(months = 6): Promise<MonthPoint[]> {
  const window = lastMonths(months);
  const since = window[0]!.start;
  const rows = await prisma.$queryRaw<{ month: Date; revenue: number | null }[]>`
    SELECT date_trunc('month', completed_at)::date AS month,
           COALESCE(SUM(price), 0)::float AS revenue
    FROM bookings
    WHERE status = 'COMPLETED' AND completed_at >= ${since}
    GROUP BY 1
    ORDER BY 1
  `;
  const map = new Map(rows.map((r) => [new Date(r.month).toISOString().slice(0, 7), Math.round(Number(r.revenue ?? 0))]));
  return window.map((m) => ({ month: m.key, label: m.label, value: map.get(m.key) ?? 0 }));
}

export async function usersSeries(months = 6): Promise<MonthPoint[]> {
  return monthlySeries("users", "created_at", months);
}

export async function requestsSeries(months = 6): Promise<MonthPoint[]> {
  return monthlySeries("service_requests", "created_at", months);
}

export async function bookingsSeries(months = 6): Promise<MonthPoint[]> {
  return monthlySeries("bookings", "created_at", months);
}

// ─── Platform overview (admin) ───────────────────────────────────────────────

export interface PlatformOverview {
  totals: {
    users: number;
    professionals: number;
    customers: number;
    admins: number;
    activeRequests: number;
    openRequests: number;
    offers: number;
    bookings: number;
    completedJobs: number;
    cancelledJobs: number;
    reviews: number;
    services: number;
    publishedServices: number;
    categories: number;
    reportsOpen: number;
    pendingVerification: number;
    suspendedUsers: number;
  };
  money: {
    bookingVolume: number;
    completedVolume: number;
    averageTicket: number;
    platformFeePotential: number;
  };
  rates: {
    completionRate: number;
    offerAcceptanceRate: number;
    requestToFulfilmentRate: number;
    averageRating: number;
    verifiedShare: number;
  };
  deltas: {
    usersThisMonth: number;
    requestsThisMonth: number;
    bookingsThisMonth: number;
    completedThisMonth: number;
  };
}

export async function platformOverview(commissionRate = 0.1): Promise<PlatformOverview> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    usersByRole,
    suspendedUsers,
    requestsByStatus,
    offersByStatus,
    bookingsByStatus,
    reviewsAgg,
    servicesByStatus,
    categories,
    reportsOpen,
    pendingVerification,
    completedMoney,
    allBookingsMoney,
    professionalsAgg,
    monthUsers,
    monthRequests,
    monthBookings,
    monthCompleted,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.user.count({ where: { status: "SUSPENDED", deletedAt: null } }),
    prisma.serviceRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.offer.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.booking.groupBy({ by: ["status"], _count: { _all: true }, _sum: { price: true } }),
    prisma.review.aggregate({ _count: { _all: true }, _avg: { rating: true }, where: { status: "PUBLISHED" } }),
    prisma.service.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.category.count({ where: { isActive: true } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.professionalProfile.count({ where: { verificationStatus: "PENDING" } }),
    prisma.booking.aggregate({ where: { status: "COMPLETED" }, _sum: { price: true }, _avg: { price: true } }),
    prisma.booking.aggregate({ _sum: { price: true } }),
    prisma.professionalProfile.aggregate({
      _count: { _all: true },
      where: { verificationStatus: "VERIFIED" },
    }),
    prisma.user.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.booking.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.booking.count({ where: { completedAt: { gte: monthStart }, status: "COMPLETED" } }),
  ]);

  const roleCount = (role: string) => usersByRole.find((r) => r.role === role)?._count._all ?? 0;
  const requestCount = (status: string) => requestsByStatus.find((r) => r.status === status)?._count._all ?? 0;
  const offerCount = (status: string) => offersByStatus.find((r) => r.status === status)?._count._all ?? 0;
  const bookingCount = (status: string) => bookingsByStatus.find((r) => r.status === status)?._count._all ?? 0;
  const serviceCount = (status: string) => servicesByStatus.find((r) => r.status === status)?._count._all ?? 0;

  const totalUsers = usersByRole.reduce((acc, r) => acc + r._count._all, 0);
  const professionals = roleCount("PROFESSIONAL");
  const allProfessionals = await prisma.professionalProfile.count();
  const verifiedProfessionals = professionalsAgg._count._all;

  const completed = bookingCount("COMPLETED");
  const cancelled = bookingCount("CANCELLED");
  const totalOffers = offersByStatus.reduce((a, r) => a + r._count._all, 0);
  const acceptedOffers = offerCount("ACCEPTED");
  const totalRequests = requestsByStatus.reduce((a, r) => a + r._count._all, 0);

  return {
    totals: {
      users: totalUsers,
      professionals,
      customers: roleCount("CUSTOMER"),
      admins: roleCount("ADMIN"),
      activeRequests: requestCount("OPEN") + requestCount("RECEIVING_OFFERS") + requestCount("OFFER_SELECTED") + requestCount("IN_PROGRESS"),
      openRequests: requestCount("OPEN") + requestCount("RECEIVING_OFFERS"),
      offers: totalOffers,
      bookings: bookingsByStatus.reduce((a, r) => a + r._count._all, 0),
      completedJobs: completed,
      cancelledJobs: cancelled,
      reviews: reviewsAgg._count._all,
      services: servicesByStatus.reduce((a, r) => a + r._count._all, 0),
      publishedServices: serviceCount("PUBLISHED"),
      categories,
      reportsOpen,
      pendingVerification,
      suspendedUsers,
    },
    money: {
      bookingVolume: allBookingsMoney._sum.price ?? 0,
      completedVolume: completedMoney._sum.price ?? 0,
      averageTicket: Math.round(completedMoney._avg.price ?? 0),
      platformFeePotential: Math.round((completedMoney._sum.price ?? 0) * commissionRate),
    },
    rates: {
      completionRate: completed + cancelled === 0 ? 0 : Math.round((completed / (completed + cancelled)) * 100),
      offerAcceptanceRate: totalOffers === 0 ? 0 : Math.round((acceptedOffers / totalOffers) * 100),
      requestToFulfilmentRate: totalRequests === 0 ? 0 : Math.round((completed / totalRequests) * 100),
      averageRating: Math.round((reviewsAgg._avg.rating ?? 0) * 10) / 10,
      verifiedShare: allProfessionals === 0 ? 0 : Math.round((verifiedProfessionals / allProfessionals) * 100),
    },
    deltas: {
      usersThisMonth: monthUsers,
      requestsThisMonth: monthRequests,
      bookingsThisMonth: monthBookings,
      completedThisMonth: monthCompleted,
    },
  };
}

export async function popularCategories(limit = 8) {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      nameFr: true,
      nameEn: true,
      icon: true,
      color: true,
      _count: { select: { services: { where: { status: "PUBLISHED" } }, serviceRequests: true } },
    },
    orderBy: { serviceRequests: { _count: "desc" } },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameFr: row.nameFr,
    nameEn: row.nameEn,
    icon: row.icon,
    color: row.color,
    requests: row._count.serviceRequests,
    services: row._count.services,
  }));
}

export async function topCities(limit = 8) {
  const citySlugs = CITIES.map((c) => c.slug);
  const [requests, services, professionals] = await Promise.all([
    prisma.serviceRequest.groupBy({ by: ["city"], _count: { _all: true }, orderBy: { _count: { city: "desc" } }, take: limit * 2 }),
    prisma.service.groupBy({ by: ["city"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
    prisma.professionalProfile.groupBy({ by: ["city"], _count: { _all: true } }),
  ]);

  const serviceMap = new Map(services.map((s) => [s.city, s._count._all]));
  const professionalMap = new Map(professionals.map((p) => [p.city, p._count._all]));

  return requests
    .filter((row) => citySlugs.includes(row.city) || row.city)
    .slice(0, limit)
    .map((row) => {
      const city = CITIES.find((c) => c.slug === row.city);
      return {
        slug: row.city,
        name: city?.name.ar ?? row.city,
        nameFr: city?.name.fr ?? row.city,
        nameEn: city?.name.en ?? row.city,
        requests: row._count._all,
        services: serviceMap.get(row.city) ?? 0,
        professionals: professionalMap.get(row.city) ?? 0,
      };
    })
    .sort((a, b) => b.requests - a.requests);
}

/** Rating histogram for the admin analytics page. */
export async function ratingDistribution() {
  const rows = await prisma.review.groupBy({
    by: ["rating"],
    where: { status: "PUBLISHED" },
    _count: { _all: true },
  });
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) counts[row.rating] = row._count._all;
  return counts;
}

// ─── Professional performance (§22) ──────────────────────────────────────────

export interface ProfessionalPerformance {
  profileId: string;
  totals: {
    requestsSeen: number;
    offersSent: number;
    offersAccepted: number;
    offersRejected: number;
    offersPending: number;
    bookings: number;
    completedJobs: number;
    cancelledJobs: number;
    upcomingBookings: number;
    reviews: number;
  };
  money: { revenueCompleted: number; revenuePipeline: number; averageTicket: number };
  rates: { acceptanceRate: number; completionRate: number; responseRate: number; averageRating: number };
  series: {
    offers: MonthPoint[];
    completed: MonthPoint[];
    revenue: MonthPoint[];
    ratings: MonthPoint[];
  };
  categories: { name: string; slug: string; count: number; revenue: number }[];
  cities: { city: string; count: number }[];
}

export async function professionalPerformance(userId: string, months = 6): Promise<ProfessionalPerformance> {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    select: { id: true, ratingAverage: true, responseRate: true, completedJobs: true, cancelledJobs: true },
  });
  if (!profile) throw notFound("Professional profile not found.");

  const window = lastMonths(months);
  const since = window[0]!.start;

  const [offersByStatus, bookingsByStatus, offerSeries, completedSeries, revenueSeriesRows, ratingSeries, cityRows, reviewCount, upcoming] =
    await Promise.all([
      prisma.offer.groupBy({ by: ["status"], where: { professionalId: userId }, _count: { _all: true } }),
      prisma.booking.groupBy({ by: ["status"], where: { professionalId: userId }, _count: { _all: true }, _sum: { price: true } }),
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT date_trunc('month', created_at)::date AS month, COUNT(*)::bigint AS count
        FROM offers WHERE professional_id = CAST(${userId} AS uuid) AND created_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: Date; count: bigint }[]>`
        SELECT date_trunc('month', completed_at)::date AS month, COUNT(*)::bigint AS count
        FROM bookings WHERE professional_id = CAST(${userId} AS uuid) AND status = 'COMPLETED' AND completed_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: Date; revenue: number | null }[]>`
        SELECT date_trunc('month', completed_at)::date AS month, COALESCE(SUM(price), 0)::float AS revenue
        FROM bookings WHERE professional_id = CAST(${userId} AS uuid) AND status = 'COMPLETED' AND completed_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ month: Date; rating: number | null }[]>`
        SELECT date_trunc('month', r.created_at)::date AS month, AVG(r.rating)::float AS rating
        FROM reviews r
        JOIN professional_profiles p ON p.id = r.professional_id
        WHERE p.user_id = CAST(${userId} AS uuid) AND r.status = 'PUBLISHED' AND r.created_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<{ city: string; count: bigint }[]>`
        SELECT city, COUNT(*)::bigint AS count FROM bookings
        WHERE professional_id = CAST(${userId} AS uuid) GROUP BY city ORDER BY count DESC LIMIT 6`,
      prisma.offer.count({
        where: {
          professionalId: userId,
          request: { status: { notIn: ["CANCELLED", "EXPIRED"] } },
        },
      }),
      prisma.review.count({ where: { professionalId: profile.id, status: "PUBLISHED" } }),
      prisma.booking.count({
        where: {
          professionalId: userId,
          status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
          scheduledDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
    ]);

  // Requests the professional could have seen: open demand in their city/category.
  const coveredCategoryIds = await prisma.service.findMany({
    where: { professionalId: profile.id },
    select: { categoryId: true, city: true },
    distinct: ["categoryId"],
  });
  const visibleRequests = coveredCategoryIds.length
    ? await prisma.serviceRequest.count({
        where: {
          status: { in: ["OPEN", "RECEIVING_OFFERS", "OFFER_SELECTED", "IN_PROGRESS", "COMPLETED"] },
          categoryId: { in: coveredCategoryIds.map((c) => c.categoryId) },
        },
      })
    : 0;

  const offerCount = (status: string) => offersByStatus.find((o) => o.status === status)?._count._all ?? 0;
  const bookingCount = (status: string) => bookingsByStatus.find((b) => b.status === status)?._count._all ?? 0;

  const totalOffers = offersByStatus.reduce((a, r) => a + r._count._all, 0);
  const accepted = offerCount("ACCEPTED");
  const completed = bookingCount("COMPLETED");
  const cancelled = bookingCount("CANCELLED");

  const completedRevenue = bookingsByStatus.find((b) => b.status === "COMPLETED")?._sum.price ?? 0;
  const pipelineRevenue =
    (bookingsByStatus.find((b) => b.status === "PENDING")?._sum.price ?? 0) +
    (bookingsByStatus.find((b) => b.status === "CONFIRMED")?._sum.price ?? 0) +
    (bookingsByStatus.find((b) => b.status === "IN_PROGRESS")?._sum.price ?? 0);

  const fill = (rows: { month: Date; value: number }[]) => {
    const map = new Map(rows.map((r) => [new Date(r.month).toISOString().slice(0, 7), r.value]));
    return window.map((m) => ({ month: m.key, label: m.label, value: map.get(m.key) ?? 0 }));
  };

  const categories = await prisma.service.groupBy({
    by: ["categoryId"],
    where: { professionalId: profile.id },
    _count: { _all: true },
  });
  const categoryDetails = categories.length
    ? await prisma.category.findMany({
        where: { id: { in: categories.map((c) => c.categoryId) } },
        select: { id: true, slug: true, name: true },
      })
    : [];
  return {
    profileId: profile.id,
    totals: {
      requestsSeen: visibleRequests,
      offersSent: totalOffers,
      offersAccepted: accepted,
      offersRejected: offerCount("REJECTED"),
      offersPending: offerCount("PENDING"),
      bookings: bookingsByStatus.reduce((a, r) => a + r._count._all, 0),
      completedJobs: completed,
      cancelledJobs: cancelled,
      upcomingBookings: upcoming,
      reviews: reviewCount,
    },
    money: {
      revenueCompleted: completedRevenue,
      revenuePipeline: pipelineRevenue,
      averageTicket: completed === 0 ? 0 : Math.round(completedRevenue / completed),
    },
    rates: {
      acceptanceRate: totalOffers === 0 ? 0 : Math.round((accepted / totalOffers) * 100),
      completionRate: completed + cancelled === 0 ? 0 : Math.round((completed / (completed + cancelled)) * 100),
      responseRate: profile.responseRate,
      averageRating: Number(profile.ratingAverage),
    },
    series: {
      offers: fill(offerSeries.map((r) => ({ month: r.month, value: Number(r.count) }))),
      completed: fill(completedSeries.map((r) => ({ month: r.month, value: Number(r.count) }))),
      revenue: fill(revenueSeriesRows.map((r) => ({ month: r.month, value: Math.round(Number(r.revenue ?? 0)) }))),
      ratings: fill(ratingSeries.map((r) => ({ month: r.month, value: Math.round((Number(r.rating ?? 0)) * 10) / 10 }))),
    },
    categories: categoryDetails
      .map((c) => ({
        name: c.name,
        slug: c.slug,
        count: categories.find((x) => x.categoryId === c.id)?._count._all ?? 0,
        revenue: 0,
      }))
      .sort((a, b) => b.count - a.count),
    cities: cityRows.map((c) => ({ city: c.city, count: Number(c.count) })),
  };
}

/** Small sparkline for the professional dashboard header. */
export async function professionalMiniStats(userId: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [newOffers, newBookings, unreadNotifications] = await Promise.all([
    prisma.offer.count({ where: { professionalId: userId, createdAt: { gte: weekAgo } } }),
    prisma.booking.count({ where: { professionalId: userId, createdAt: { gte: weekAgo } } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { newOffers, newBookings, unreadNotifications };
}
