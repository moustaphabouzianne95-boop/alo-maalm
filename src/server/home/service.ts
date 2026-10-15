import { prisma } from "@/lib/db/prisma";
import { REVIEW_INCLUDE } from "@/server/reviews/service";

/**
 * Read models for the public landing page.
 *
 * Everything here is derived from real rows — the counters on the hero and the
 * testimonials are computed from the same tables the dashboards use, so the
 * marketing surface can never claim something the database does not contain.
 */

export interface HomeStats {
  verifiedProfessionals: number;
  publishedServices: number;
  cities: number;
  averageRating: number;
  reviews: number;
  completedBookings: number;
}

const GOOD_STANDING = { user: { status: "ACTIVE" as const, deletedAt: null } };

export async function homeStats(): Promise<HomeStats> {
  const [verifiedProfessionals, publishedServices, cityRows, ratingAgg, reviews, completedBookings] =
    await Promise.all([
      prisma.professionalProfile.count({
        where: { verificationStatus: "VERIFIED", ...GOOD_STANDING },
      }),
      prisma.service.count({
        where: { status: "PUBLISHED", professional: GOOD_STANDING },
      }),
      prisma.professionalProfile.findMany({
        where: { ...GOOD_STANDING },
        select: { city: true },
        distinct: ["city"],
      }),
      prisma.review.aggregate({
        where: { status: "PUBLISHED" },
        _avg: { rating: true },
      }),
      prisma.review.count({ where: { status: "PUBLISHED" } }),
      prisma.booking.count({ where: { status: "COMPLETED" } }),
    ]);

  return {
    verifiedProfessionals,
    publishedServices,
    cities: cityRows.length,
    averageRating: Math.round((ratingAgg._avg.rating ?? 0) * 10) / 10,
    reviews,
    completedBookings,
  };
}

export interface HomeTestimonial {
  id: string;
  comment: string;
  rating: number;
  createdAt: Date;
  authorName: string;
  city: string | null;
  serviceTitle: string | null;
  professionalSlug: string;
  professionalName: string;
}

/**
 * Real 5-star reviews with a substantive comment, newest first.
 * We over-fetch and filter in memory because Prisma cannot express
 * `length(comment) > 40`.
 */
export async function homeTestimonials(limit = 3): Promise<HomeTestimonial[]> {
  const rows = await prisma.review.findMany({
    where: { status: "PUBLISHED", rating: 5 },
    orderBy: { createdAt: "desc" },
    take: 24,
    include: REVIEW_INCLUDE,
  });

  const picked: HomeTestimonial[] = [];
  for (const row of rows) {
    const comment = (row.comment ?? "").trim();
    if (comment.length < 40) continue;
    const identity = row.author.identity;
    picked.push({
      id: row.id,
      comment,
      rating: row.rating,
      createdAt: row.createdAt,
      authorName: identity?.firstName?.trim() || identity?.fullName?.trim() || "—",
      city: row.booking.city,
      serviceTitle: row.service?.title ?? row.booking.title,
      professionalSlug: row.professional.slug,
      professionalName:
        row.professional.businessName?.trim() ||
        row.professional.user.identity?.fullName?.trim() ||
        "—",
    });
    if (picked.length >= limit) break;
  }
  return picked;
}
