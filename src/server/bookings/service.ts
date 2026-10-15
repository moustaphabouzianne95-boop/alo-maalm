import type { Prisma, BookingStatus, CancellationParty } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, sanitizedTextSchema } from "@/lib/validation/common";
import { canManageBooking, type Actor } from "@/lib/permissions";
import { createNotifications, type CreateNotificationInput } from "@/server/notifications/service";
import type { NotificationType } from "@/lib/notifications/types";

/**
 * Bookings — the supply/fulfilment side.
 *
 * Statuses form a strict machine (§16). Illegal transitions (e.g.
 * CANCELLED → COMPLETED) are rejected before anything is written, and every
 * change is appended to `booking_status_history` for auditability.
 */

export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export type BookingActorRole = "CUSTOMER" | "PROFESSIONAL" | "ADMIN";

/**
 * Who may drive which transition. `null` means "not allowed for that role".
 * Completion is the customer's call (§14) — the professional can only start
 * and confirm, never self-complete a job.
 */
const TRANSITION_ROLES: Record<BookingStatus, Partial<Record<BookingActorRole, boolean>>> = {
  CONFIRMED: { PROFESSIONAL: true, ADMIN: true },
  IN_PROGRESS: { PROFESSIONAL: true, ADMIN: true },
  COMPLETED: { CUSTOMER: true, ADMIN: true },
  CANCELLED: { CUSTOMER: true, PROFESSIONAL: true, ADMIN: true },
  PENDING: {},
};

export function canTransitionBooking(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function bookingActorRole(
  actor: Actor,
  booking: { customerId: string; professionalId: string }
): BookingActorRole | null {
  if (!actor) return null;
  if (actor.role === "ADMIN") return "ADMIN";
  if (actor.id === booking.customerId) return "CUSTOMER";
  if (actor.id === booking.professionalId) return "PROFESSIONAL";
  return null;
}

export function canPerformTransition(
  actor: Actor,
  booking: { customerId: string; professionalId: string; status: BookingStatus },
  to: BookingStatus
): boolean {
  const role = bookingActorRole(actor, booking);
  if (!role) return false;
  if (!canTransitionBooking(booking.status, to)) return false;
  return TRANSITION_ROLES[to][role] === true;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export const updateBookingSchema = z.object({
  status: z.enum(["CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  scheduledDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : undefined)),
  scheduledTime: z.string().trim().max(24).optional(),
  address: sanitizedTextSchema.pipe(z.string().trim().min(3).max(300)).optional(),
  notes: sanitizedTextSchema.pipe(z.string().trim().max(1000)).optional().nullable(),
  cancellationReason: sanitizedTextSchema.pipe(z.string().trim().max(500)).optional().nullable(),
});

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;

/** Rescheduling + notes only; status changes go through `/transition`. */
export const patchBookingSchema = z.object({
  scheduledDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : undefined)),
  scheduledTime: z.string().trim().max(24).optional(),
  address: sanitizedTextSchema.pipe(z.string().trim().min(3).max(300)).optional(),
  notes: sanitizedTextSchema.pipe(z.string().trim().max(1000)).optional().nullable(),
});

export type PatchBookingInput = z.infer<typeof patchBookingSchema>;

// ─── Reads ───────────────────────────────────────────────────────────────────

export const BOOKING_LIST_INCLUDE = {
  customer: { select: { id: true, identity: { select: { fullName: true, firstName: true, avatarUrl: true } } } },
  professional: {
    select: {
      id: true,
      identity: { select: { fullName: true, firstName: true, avatarUrl: true } },
      professionalProfile: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          avatarUrl: true,
          verificationStatus: true,
          ratingAverage: true,
          ratingCount: true,
          city: true,
        },
      },
    },
  },
  request: { select: { id: true, reference: true, title: true, city: true, category: { select: { slug: true, name: true, nameFr: true, nameEn: true, icon: true } } } },
  offer: { select: { id: true, reference: true, message: true } },
  service: { select: { id: true, slug: true, title: true, coverImage: true } },
  review: { select: { id: true, rating: true, comment: true, createdAt: true } },
} as const satisfies Prisma.BookingInclude;

export type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_LIST_INCLUDE }>;

export type BookingTab = "upcoming" | "active" | "completed" | "cancelled" | "all";

export interface ListBookingsInput extends Partial<PaginationInput> {
  actorId: string;
  role: BookingActorRole;
  tab?: BookingTab;
  status?: BookingStatus;
  search?: string;
  city?: string;
}

function tabFilter(tab: BookingTab | undefined, status: BookingStatus | undefined): Prisma.BookingWhereInput {
  if (status) return { status };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (tab) {
    case "upcoming":
      return { status: { in: ["PENDING", "CONFIRMED"] }, scheduledDate: { gte: today } };
    case "active":
      return { status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] } };
    case "completed":
      return { status: "COMPLETED" };
    case "cancelled":
      return { status: "CANCELLED" };
    case "all":
    default:
      return {};
  }
}

export async function listBookings(input: ListBookingsInput) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 10));

  const side: Prisma.BookingWhereInput =
    input.role === "PROFESSIONAL"
      ? { professionalId: input.actorId }
      : input.role === "CUSTOMER"
        ? { customerId: input.actorId }
        : {};

  const where: Prisma.BookingWhereInput = {
    AND: [
      side,
      tabFilter(input.tab, input.status),
      input.city ? { city: input.city } : {},
      input.search
        ? {
            OR: [
              { reference: { contains: input.search.toUpperCase(), mode: "insensitive" } },
              { title: { contains: input.search, mode: "insensitive" } },
              { city: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: BOOKING_LIST_INCLUDE,
    }),
    prisma.booking.count({ where }),
  ]);

  return { items, ...paginationMeta(page, perPage, total) };
}

export async function getBooking(actor: Actor, id: string) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      ...BOOKING_LIST_INCLUDE,
      statusHistory: { orderBy: { createdAt: "asc" } },
      review: {
        include: {
          author: { select: { id: true, identity: { select: { fullName: true, avatarUrl: true } } } },
        },
      },
      request: {
        select: {
          id: true,
          reference: true,
          title: true,
          description: true,
          city: true,
          neighborhood: true,
          urgency: true,
          category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true } },
        },
      },
    },
  });
  if (!booking) throw notFound("Booking not found.");
  if (!canManageBooking(actor, booking)) throw forbidden();
  return booking;
}

/** Conversations are auto-created around a booking; this keeps them linked. */
export async function getBookingConversation(bookingId: string, userId: string) {
  return prisma.conversation.findFirst({
    where: { bookingId, OR: [{ customerId: userId }, { professionalId: userId }] },
    select: { id: true },
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

const NOTIFICATION_FOR_STATUS: Record<BookingStatus, { type: NotificationType; titleAr: string }> = {
  PENDING: { type: "BOOKING_CREATED", titleAr: "تم إنشاء حجز" },
  CONFIRMED: { type: "BOOKING_CONFIRMED", titleAr: "تم تأكيد الحجز" },
  IN_PROGRESS: { type: "BOOKING_STARTED", titleAr: "بدأ إنجاز الخدمة" },
  COMPLETED: { type: "BOOKING_COMPLETED", titleAr: "اكتملت الخدمة" },
  CANCELLED: { type: "BOOKING_CANCELLED", titleAr: "تم إلغاء الحجز" },
};

export interface TransitionBookingInput {
  status: BookingStatus;
  reason?: string | null;
  /** Reschedule fields accepted together with CONFIRMED. */
  scheduledDate?: Date;
  scheduledTime?: string;
}

export async function transitionBooking(actor: Actor, id: string, input: TransitionBookingInput) {
  if (!actor) throw forbidden();

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      status: true,
      title: true,
      price: true,
      customerId: true,
      professionalId: true,
      requestId: true,
      offerId: true,
      scheduledDate: true,
    },
  });
  if (!booking) throw notFound("Booking not found.");

  const role = bookingActorRole(actor, booking);
  if (!role) throw forbidden();
  if (!canTransitionBooking(booking.status, input.status)) {
    throw unprocessable(`A booking cannot move from ${booking.status} to ${input.status}.`);
  }
  if (TRANSITION_ROLES[input.status][role] !== true) {
    throw forbidden(
      input.status === "COMPLETED"
        ? "Only the customer can confirm that the job is finished."
        : "You are not allowed to perform this change."
    );
  }

  const now = new Date();
  const timestamps: Prisma.BookingUpdateInput = {};
  if (input.status === "CONFIRMED") timestamps.confirmedAt = now;
  if (input.status === "IN_PROGRESS") timestamps.startedAt = now;
  if (input.status === "COMPLETED") timestamps.completedAt = now;
  if (input.status === "CANCELLED") {
    timestamps.cancelledAt = now;
    timestamps.cancelledBy = role as CancellationParty;
    timestamps.cancellationReason = input.reason ?? null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: input.status,
        ...timestamps,
        ...(input.scheduledDate ? { scheduledDate: input.scheduledDate } : {}),
        ...(input.scheduledTime ? { scheduledTime: input.scheduledTime } : {}),
        statusHistory: {
          create: {
            from: booking.status,
            to: input.status,
            changedBy: actor.id,
            reason: input.reason ?? null,
          },
        },
      },
      include: BOOKING_LIST_INCLUDE,
    });

    // Keep the parent request in sync with the booking it produced.
    if (input.status === "COMPLETED") {
      await tx.serviceRequest.updateMany({
        where: { id: booking.requestId },
        data: { status: "COMPLETED", closedAt: now },
      });
    } else if (input.status === "IN_PROGRESS") {
      await tx.serviceRequest.updateMany({
        where: { id: booking.requestId },
        data: { status: "IN_PROGRESS" },
      });
    } else if (input.status === "CANCELLED") {
      const jobStarted = booking.status === "IN_PROGRESS";
      if (jobStarted) {
        // Work already happened — the demand is closed.
        await tx.serviceRequest.updateMany({
          where: { id: booking.requestId },
          data: { status: "CANCELLED", closedAt: now, cancelledReason: input.reason ?? null },
        });
        await tx.offer.updateMany({ where: { id: booking.offerId }, data: { status: "EXPIRED" } });
      } else {
        // Nothing was delivered: reopen the request so the customer can accept
        // a different professional, and void only this offer.
        await tx.serviceRequest.updateMany({
          where: { id: booking.requestId },
          data: {
            status: "RECEIVING_OFFERS",
            selectedOfferId: null,
            bookingId: null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
        await tx.offer.updateMany({ where: { id: booking.offerId }, data: { status: "EXPIRED" } });
      }
      const profile = await tx.professionalProfile.findUnique({
        where: { userId: booking.professionalId },
        select: { id: true, cancelledJobs: true },
      });
      if (profile) {
        await tx.professionalProfile.update({
          where: { id: profile.id },
          data: { cancelledJobs: profile.cancelledJobs + 1 },
        });
      }
    }

    // Notify the *other* party.
    const counterpartId = role === "CUSTOMER" ? booking.professionalId : booking.customerId;
    const meta = NOTIFICATION_FOR_STATUS[input.status];
    const notifications: CreateNotificationInput[] = [
      {
        userId: counterpartId,
        type: meta.type,
        role: role === "CUSTOMER" ? "PROFESSIONAL" : "CUSTOMER",
        title: meta.titleAr,
        body: `${booking.title} (${booking.reference})`,
        data: { bookingId: booking.id, bookingReference: booking.reference, amount: booking.price },
        linkTo:
          role === "CUSTOMER"
            ? `/professional/bookings/${booking.id}`
            : `/dashboard/bookings/${booking.id}`,
      },
    ];
    await tx.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body ?? null,
        data: (n.data ?? {}) as Prisma.InputJsonValue,
        linkTo: n.linkTo ?? null,
        channels: { inApp: "sent", email: "skipped", push: "skipped" } as Prisma.InputJsonValue,
      })),
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: `BOOKING_${input.status}`,
        targetType: "BOOKING",
        targetId: booking.id,
        metadata: { from: booking.status, to: input.status, reason: input.reason ?? null, role },
      },
    });

    return updated;
  });

  // Completion bumps the professional's public counter (outside the write txn
  // so a stats failure never rolls back the customer's confirmation).
  if (input.status === "COMPLETED") {
    await incrementCompletedJobs(booking.professionalId).catch(() => undefined);
  }

  return result;
}

async function incrementCompletedJobs(professionalUserId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: professionalUserId },
    select: { id: true },
  });
  if (!profile) return;
  const completed = await prisma.booking.count({
    where: { professionalId: professionalUserId, status: "COMPLETED" },
  });
  await prisma.professionalProfile.update({
    where: { id: profile.id },
    data: { completedJobs: completed },
  });
}

export async function updateBookingDetails(actor: Actor, id: string, input: Partial<PatchBookingInput>) {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, customerId: true, professionalId: true, status: true },
  });
  if (!booking) throw notFound("Booking not found.");
  if (!canManageBooking(actor, booking)) throw forbidden();
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    throw unprocessable("A closed booking can no longer be edited.");
  }

  const data: Prisma.BookingUpdateInput = {};
  if (input.scheduledDate !== undefined) data.scheduledDate = input.scheduledDate;
  if (input.scheduledTime !== undefined) data.scheduledTime = input.scheduledTime;
  if (input.address !== undefined) data.address = input.address;
  if (input.notes !== undefined) data.notes = input.notes;

  return prisma.booking.update({ where: { id }, data, include: BOOKING_LIST_INCLUDE });
}

export async function cancelBooking(actor: Actor, id: string, reason?: string | null) {
  return transitionBooking(actor, id, { status: "CANCELLED", reason });
}

/**
 * Payment fields exist for the future integration; the MVP records only the
 * agreed method so both parties see the same expectation (§50).
 */
export async function setPaymentMethod(actor: Actor, id: string, method: "CASH" | "TRANSFER" | "OTHER") {
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, customerId: true, professionalId: true, status: true },
  });
  if (!booking) throw notFound("Booking not found.");
  if (!canManageBooking(actor, booking)) throw forbidden();
  if (booking.status === "CANCELLED") throw unprocessable("A cancelled booking has no payment.");
  return prisma.booking.update({ where: { id }, data: { paymentMethod: method } });
}

// ─── Aggregates ──────────────────────────────────────────────────────────────

export async function bookingCounts(actorId: string, role: BookingActorRole) {
  const side = role === "PROFESSIONAL" ? { professionalId: actorId } : { customerId: actorId };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [active, upcoming, completed, cancelled, revenueAgg] = await Promise.all([
    prisma.booking.count({ where: { ...side, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] } } }),
    prisma.booking.count({ where: { ...side, status: { in: ["PENDING", "CONFIRMED"] }, scheduledDate: { gte: today } } }),
    prisma.booking.count({ where: { ...side, status: "COMPLETED" } }),
    prisma.booking.count({ where: { ...side, status: "CANCELLED" } }),
    prisma.booking.aggregate({ where: { ...side, status: "COMPLETED" }, _sum: { price: true }, _avg: { price: true } }),
  ]);

  return {
    active,
    upcoming,
    completed,
    cancelled,
    total: active + completed + cancelled,
    revenue: _sumOrZero(revenueAgg._sum.price),
    averageTicket: Math.round(revenueAgg._avg.price ?? 0),
    completionRate:
      completed + cancelled === 0 ? 0 : Math.round((completed / (completed + cancelled)) * 100),
  };
}

function _sumOrZero(value: number | null | undefined) {
  return value ?? 0;
}

/** Next booking for a dashboard hero card. */
export async function nextBooking(actorId: string, role: BookingActorRole) {
  const side = role === "PROFESSIONAL" ? { professionalId: actorId } : { customerId: actorId };
  return prisma.booking.findFirst({
    where: { ...side, status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] } },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    include: BOOKING_LIST_INCLUDE,
  });
}
