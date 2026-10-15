import type { Prisma, ReviewStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable, conflict } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, ratingSchema, sanitizedTextSchema } from "@/lib/validation/common";
import { type Actor } from "@/lib/permissions";
import { createNotifications } from "@/server/notifications/service";
import { recomputeProfessionalStats } from "@/server/professionals/service";

/**
 * Reviews (§19).
 *
 * Eligibility rules are enforced server-side and backed by a DB unique
 * constraint on `bookingId`:
 *   • only the customer of a COMPLETED booking may review
 *   • exactly one review per booking
 *   • cancelled bookings cannot be reviewed
 *   • edits are allowed only inside `editableUntil` (30 days)
 *
 * Writing a review recomputes the professional's public rating inside the same
 * transaction, so the directory never shows a stale average.
 */

export const REVIEW_EDIT_WINDOW_DAYS = 30;

export const createReviewSchema = z.object({
  rating: ratingSchema,
  comment: sanitizedTextSchema.pipe(z.string().trim().max(2000)).optional().nullable(),
  subRatings: z
    .object({
      punctuality: ratingSchema.optional(),
      quality: ratingSchema.optional(),
      communication: ratingSchema.optional(),
    })
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const REVIEW_INCLUDE = {
  author: { select: { id: true, identity: { select: { fullName: true, firstName: true, avatarUrl: true } } } },
  booking: {
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      scheduledDate: true,
      completedAt: true,
      city: true,
    },
  },
  service: { select: { id: true, slug: true, title: true } },
  professional: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      avatarUrl: true,
      userId: true,
      verificationStatus: true,
      user: { select: { id: true, identity: { select: { fullName: true } } } },
    },
  },
} as const satisfies Prisma.ReviewInclude;

export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListReviewsInput extends Partial<PaginationInput> {
  professionalId?: string;
  professionalUserId?: string;
  serviceId?: string;
  authorId?: string;
  rating?: number;
  status?: ReviewStatus;
  withReplies?: boolean;
}

export async function listReviews(input: ListReviewsInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 10));

  const where: Prisma.ReviewWhereInput = {
    ...(input.status ? { status: input.status } : { status: "PUBLISHED" as const }),
    ...(input.professionalId ? { professionalId: input.professionalId } : {}),
    ...(input.professionalUserId ? { professional: { userId: input.professionalUserId } } : {}),
    ...(input.serviceId ? { serviceId: input.serviceId } : {}),
    ...(input.authorId ? { authorId: input.authorId } : {}),
    ...(input.rating ? { rating: input.rating } : {}),
  };

  const [items, total, distribution] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: REVIEW_INCLUDE,
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
  ]);

  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution) counts[row.rating] = row._count._all;

  return { items, distribution: counts, ...paginationMeta(page, perPage, total) };
}

export async function reviewSummary(professionalProfileId: string) {
  const [aggregate, distribution] = await Promise.all([
    prisma.review.aggregate({
      where: { professionalId: professionalProfileId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.review.groupBy({
      by: ["rating"],
      where: { professionalId: professionalProfileId, status: "PUBLISHED" },
      _count: { _all: true },
    }),
  ]);
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of distribution) counts[row.rating] = row._count._all;
  return {
    average: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
    count: aggregate._count._all,
    distribution: counts,
  };
}

/** Bookings a customer may still review — powers the "rate your job" prompt. */
export async function reviewableBookings(customerId: string) {
  return prisma.booking.findMany({
    where: { customerId, status: "COMPLETED", review: null },
    orderBy: { completedAt: "desc" },
    take: 10,
    include: {
      professional: {
        select: {
          id: true,
          identity: { select: { fullName: true } },
          professionalProfile: { select: { id: true, slug: true, businessName: true, avatarUrl: true } },
        },
      },
      request: { select: { title: true } },
    },
  });
}

export async function getReview(actor: Actor, id: string) {
  const review = await prisma.review.findUnique({ where: { id }, include: REVIEW_INCLUDE });
  if (!review) throw notFound("Review not found.");
  const isAdmin = actor?.role === "ADMIN";
  const isAuthor = actor?.id === review.authorId;
  const isSubject = review.professional.userId === actor?.id;
  if (!actor || (!isAdmin && !isAuthor && !isSubject && review.status !== "PUBLISHED")) throw forbidden();
  return review;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

export async function createReviewForBooking(actor: Actor, bookingId: string, input: CreateReviewInput) {
  if (!actor) throw forbidden();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      reference: true,
      title: true,
      status: true,
      customerId: true,
      professionalId: true,
      serviceId: true,
      completedAt: true,
      review: { select: { id: true } },
    },
  });
  if (!booking) throw notFound("Booking not found.");

  // 1. Only the customer who bought the job.
  if (booking.customerId !== actor.id) {
    throw forbidden("Only the customer of this booking can leave a review.");
  }
  // 2. Cancelled jobs cannot be reviewed.
  if (booking.status === "CANCELLED") {
    throw unprocessable("Cancelled bookings cannot be reviewed.");
  }
  // 3. The job must actually have happened.
  if (booking.status !== "COMPLETED") {
    throw unprocessable("You can review this booking once the job is marked as completed.");
  }
  // 4. One review per booking.
  if (booking.review) {
    throw conflict("You have already reviewed this booking.");
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: booking.professionalId },
    select: { id: true, businessName: true, userId: true },
  });
  if (!profile) throw unprocessable("The professional profile no longer exists.");

  const editableUntil = new Date(Date.now() + REVIEW_EDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        bookingId: booking.id,
        authorId: actor.id,
        professionalId: profile.id,
        serviceId: booking.serviceId,
        rating: input.rating,
        comment: input.comment ?? null,
        subRatings: input.subRatings ? (input.subRatings as Prisma.InputJsonValue) : undefined,
        status: "PUBLISHED",
        editableUntil,
      },
      include: REVIEW_INCLUDE,
    });

    // Recompute the professional's public average in the same transaction.
    const aggregate = await tx.review.aggregate({
      where: { professionalId: profile.id, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.professionalProfile.update({
      where: { id: profile.id },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 100) / 100,
        ratingCount: aggregate._count._all,
      },
    });

    if (booking.serviceId) {
      const serviceAgg = await tx.review.aggregate({
        where: { serviceId: booking.serviceId, status: "PUBLISHED" },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.service.update({
        where: { id: booking.serviceId },
        data: {
          ratingAverage: Math.round((serviceAgg._avg.rating ?? 0) * 100) / 100,
          ratingCount: serviceAgg._count._all,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: "REVIEW_RECEIVED",
        title: "تقييم جديد",
        body: `${booking.title} — ${input.rating}/5`,
        data: { reviewId: created.id, bookingId: booking.id, bookingReference: booking.reference, amount: input.rating },
        linkTo: "/professional/reviews",
        channels: { inApp: "sent", email: "skipped", push: "skipped" },
      },
    });

    return created;
  });

  return review;
}

export async function updateReview(actor: Actor, id: string, input: Partial<CreateReviewInput>) {
  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true, authorId: true, professionalId: true, serviceId: true, editableUntil: true, status: true },
  });
  if (!review) throw notFound("Review not found.");
  if (review.authorId !== actor?.id && actor?.role !== "ADMIN") throw forbidden();
  if (review.editableUntil && review.editableUntil < new Date()) {
    throw unprocessable("This review can no longer be edited.");
  }

  const data: Prisma.ReviewUpdateInput = { isEdited: true };
  if (input.rating !== undefined) data.rating = input.rating;
  if (input.comment !== undefined) data.comment = input.comment;
  if (input.subRatings !== undefined) data.subRatings = input.subRatings as Prisma.InputJsonValue;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({ where: { id }, data, include: REVIEW_INCLUDE });
    if (input.rating !== undefined) {
      await recomputeProfessionalStats(review.professionalId, tx);
      if (review.serviceId) {
        const serviceAgg = await tx.review.aggregate({
          where: { serviceId: review.serviceId, status: "PUBLISHED" },
          _avg: { rating: true },
          _count: { _all: true },
        });
        await tx.service.update({
          where: { id: review.serviceId },
          data: {
            ratingAverage: Math.round((serviceAgg._avg.rating ?? 0) * 100) / 100,
            ratingCount: serviceAgg._count._all,
          },
        });
      }
    }
    return updated;
  });
}

/** Professional reply — one per review, editable while the review is editable. */
export async function replyToReview(actor: Actor, id: string, reply: string) {
  const review = await prisma.review.findUnique({
    where: { id },
    select: { id: true, authorId: true, professional: { select: { userId: true } }, status: true },
  });
  if (!review) throw notFound("Review not found.");
  if (review.professional.userId !== actor?.id && actor?.role !== "ADMIN") {
    throw forbidden("Only the reviewed professional can reply.");
  }
  const trimmed = reply.trim();
  if (trimmed.length < 3) throw unprocessable("Write a slightly longer reply.");
  if (trimmed.length > 1000) throw unprocessable("A reply cannot exceed 1000 characters.");

  const updated = await prisma.review.update({
    where: { id },
    data: { reply: trimmed, repliedAt: new Date() },
    include: REVIEW_INCLUDE,
  });

  await createNotifications([
    {
      userId: review.authorId,
      type: "REVIEW_REPLY",
      role: "CUSTOMER",
      title: "رد المعلم على تقييمك",
      body: trimmed.slice(0, 120),
      data: { reviewId: id },
      linkTo: "/dashboard/reviews",
    },
  ]).catch(() => undefined);

  return updated;
}

export async function markReviewHelpful(id: string) {
  return prisma.review.update({ where: { id }, data: { helpfulCount: { increment: 1 } }, select: { id: true, helpfulCount: true } });
}

// ─── Moderation ──────────────────────────────────────────────────────────────

export async function setReviewStatus(adminId: string, id: string, status: ReviewStatus, reason?: string) {
  const review = await prisma.review.findUnique({ where: { id }, select: { id: true, professionalId: true } });
  if (!review) throw notFound("Review not found.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id },
      data: { status, hiddenReason: status === "HIDDEN" ? (reason ?? null) : null, moderatedById: adminId, moderatedAt: new Date() },
    });
    const aggregate = await tx.review.aggregate({
      where: { professionalId: review.professionalId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.professionalProfile.update({
      where: { id: review.professionalId },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 100) / 100,
        ratingCount: aggregate._count._all,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: status === "HIDDEN" ? "REVIEW_HIDDEN" : status === "PUBLISHED" ? "REVIEW_RESTORED" : "REVIEW_FLAGGED",
        targetType: "REVIEW",
        targetId: id,
        metadata: { status, reason: reason ?? null },
      },
    });
    return updated;
  });
}

export async function deleteReview(adminId: string, id: string, reason: string) {
  const review = await prisma.review.findUnique({ where: { id }, select: { id: true, professionalId: true, serviceId: true } });
  if (!review) throw notFound("Review not found.");

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    const aggregate = await tx.review.aggregate({
      where: { professionalId: review.professionalId, status: "PUBLISHED" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.professionalProfile.update({
      where: { id: review.professionalId },
      data: {
        ratingAverage: Math.round((aggregate._avg.rating ?? 0) * 100) / 100,
        ratingCount: aggregate._count._all,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "REVIEW_DELETED",
        targetType: "REVIEW",
        targetId: id,
        metadata: { reason },
      },
    });
  });

  return { id, deleted: true };
}

/** Reviews written by a customer (dashboard → "my reviews"). */
export async function listMyReviews(actorId: string, input: Partial<PaginationInput> = {}) {
  return listReviews({ ...input, authorId: actorId, status: undefined });
}
