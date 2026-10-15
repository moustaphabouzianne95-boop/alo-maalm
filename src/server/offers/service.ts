import { Prisma, type OfferStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable, conflict } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, moneySchema, sanitizedTextSchema } from "@/lib/validation/common";
import { makeReference } from "@/lib/utils";
import { canManageOffer, canDecideOffer, type Actor } from "@/lib/permissions";
import { createNotifications, type CreateNotificationInput } from "@/server/notifications/service";
import { OFFERABLE_STATUSES, REQUEST_TRANSITIONS } from "@/server/requests/service";

/**
 * Offers / quotations — the heart of the marketplace.
 *
 * Accepting an offer is a single SERIALIZABLE transaction that: verifies the
 * actor, verifies ownership of the request, verifies the offer still belongs to
 * it and is PENDING, closes competing offers, creates the booking, advances the
 * request, records the decision and emits notifications. If any step fails the
 * whole thing rolls back — no partial state, no double-booking (§15, §53).
 */

export const OFFER_VALIDITY_DAYS = 7;

export const createOfferSchema = z.object({
  price: moneySchema.refine((v) => v > 0, "money_must_be_positive"),
  message: sanitizedTextSchema.pipe(z.string().trim().min(10, "message_too_short").max(2000, "message_too_long")),
  notes: sanitizedTextSchema.pipe(z.string().trim().max(1000)).optional().nullable(),
  durationMin: z.coerce.number().int().min(5).max(60 * 24 * 30).optional().nullable(),
  proposedDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
  proposedTime: z.string().trim().max(24).optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  validUntil: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date")
    .optional()
    .nullable()
    .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null)),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const updateOfferSchema = createOfferSchema.partial();
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

export const OFFER_INCLUDE = {
  professional: {
    select: {
      id: true,
      identity: { select: { fullName: true, firstName: true, avatarUrl: true } },
      professionalProfile: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          headline: true,
          avatarUrl: true,
          city: true,
          neighborhood: true,
          yearsExperience: true,
          verificationStatus: true,
          availabilityStatus: true,
          ratingAverage: true,
          ratingCount: true,
          completedJobs: true,
          responseRate: true,
          responseTimeMin: true,
        },
      },
    },
  },
  request: {
    select: {
      id: true,
      reference: true,
      title: true,
      city: true,
      status: true,
      customerId: true,
      category: { select: { id: true, slug: true, name: true, nameFr: true, nameEn: true, icon: true } },
      customer: { select: { id: true, identity: { select: { fullName: true, firstName: true, avatarUrl: true } } } },
    },
  },
  booking: { select: { id: true, reference: true, status: true } },
} as const satisfies Prisma.OfferInclude;

export type OfferRow = Prisma.OfferGetPayload<{ include: typeof OFFER_INCLUDE }>;

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function listOffersForRequest(actor: Actor, requestId: string) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { id: true, customerId: true, status: true },
  });
  if (!request) throw notFound("Request not found.");

  const isOwner = actor?.id === request.customerId;
  const isAdmin = actor?.role === "ADMIN";
  const isProfessional = actor?.role === "PROFESSIONAL";
  if (!actor || (!isOwner && !isAdmin && !isProfessional)) throw forbidden();

  const items = await prisma.offer.findMany({
    where: {
      requestId,
      // Professionals only see their own offer on somebody else's request —
      // competing quotes are private to the customer (§15).
      ...(isOwner || isAdmin ? {} : { professionalId: actor.id }),
    },
    orderBy: [{ status: "asc" }, { price: "asc" }, { createdAt: "asc" }],
    include: OFFER_INCLUDE,
  });

  return { items, canDecide: isOwner || isAdmin, request };
}

export interface ListMyOffersInput extends Partial<PaginationInput> {
  actorId: string;
  status?: OfferStatus;
  scope: "sent" | "received";
  search?: string;
}

export async function listOffers(input: ListMyOffersInput) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(50, Math.max(1, input.perPage ?? 10));

  const where: Prisma.OfferWhereInput =
    input.scope === "sent"
      ? {
          professionalId: input.actorId,
          ...(input.status ? { status: input.status } : {}),
          ...(input.search ? { request: { title: { contains: input.search, mode: "insensitive" } } } : {}),
        }
      : {
          request: { customerId: input.actorId },
          ...(input.status ? { status: input.status } : {}),
          ...(input.search ? { request: { title: { contains: input.search, mode: "insensitive" } } } : {}),
        };

  const [items, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: OFFER_INCLUDE,
    }),
    prisma.offer.count({ where }),
  ]);

  return { items, ...paginationMeta(page, perPage, total) };
}

export async function getOffer(actor: Actor, id: string) {
  const offer = await prisma.offer.findUnique({ where: { id }, include: OFFER_INCLUDE });
  if (!offer) throw notFound("Offer not found.");
  const isParty =
    actor?.id === offer.professionalId ||
    actor?.id === offer.request.customerId ||
    actor?.role === "ADMIN";
  if (!actor || !isParty) throw forbidden();
  return offer;
}

// ─── Writes ──────────────────────────────────────────────────────────────────

async function uniqueOfferReference(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reference = makeReference("OFR");
    const exists = await prisma.offer.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  return makeReference("OFR", 8);
}

export async function createOffer(actor: Actor, requestId: string, input: CreateOfferInput) {
  if (!actor) throw forbidden();
  if (actor.role !== "PROFESSIONAL" && actor.role !== "ADMIN") {
    throw forbidden("Only professionals can submit offers.");
  }

  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      reference: true,
      title: true,
      city: true,
      status: true,
      customerId: true,
      maxOffers: true,
      offersCount: true,
      expiresAt: true,
      category: { select: { name: true } },
    },
  });
  if (!request) throw notFound("Request not found.");
  if (request.customerId === actor.id) throw unprocessable("You cannot send an offer on your own request.");
  if (!OFFERABLE_STATUSES.includes(request.status)) {
    throw unprocessable("This request is closed for new offers.");
  }
  if (request.expiresAt && request.expiresAt < new Date()) {
    throw unprocessable("This request has expired.");
  }
  if (request.offersCount >= request.maxOffers) {
    throw conflict("This request already received the maximum number of offers.");
  }

  const profile = await prisma.professionalProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true, verificationStatus: true, availabilityStatus: true, responseTimeMin: true },
  });
  if (!profile) throw forbidden("A professional profile is required to submit offers.");
  if (profile.verificationStatus === "SUSPENDED" || profile.verificationStatus === "REJECTED") {
    throw forbidden("Your professional account is not allowed to submit offers.");
  }
  if (profile.availabilityStatus === "UNAVAILABLE") {
    throw unprocessable("Set your availability to “available” before sending offers.");
  }

  const existing = await prisma.offer.findUnique({
    where: { requestId_professionalId: { requestId, professionalId: actor.id } },
    select: { id: true, status: true },
  });
  if (existing && existing.status === "PENDING") {
    throw conflict("You have already sent an offer for this request.");
  }
  if (existing && existing.status === "ACCEPTED") {
    throw conflict("Your offer for this request was already accepted.");
  }

  const reference = await uniqueOfferReference();
  const now = new Date();
  const validUntil = input.validUntil ?? new Date(now.getTime() + OFFER_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  const offer = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction: two professionals submitting at the
    // exact same moment must not exceed `maxOffers`.
    const fresh = await tx.serviceRequest.findUnique({
      where: { id: requestId },
      select: { status: true, offersCount: true, maxOffers: true },
    });
    if (!fresh || !OFFERABLE_STATUSES.includes(fresh.status)) {
      throw unprocessable("This request is closed for new offers.");
    }
    if (fresh.offersCount >= fresh.maxOffers) {
      throw conflict("This request already received the maximum number of offers.");
    }

    const created = existing
      ? await tx.offer.update({
          where: { id: existing.id },
          data: {
            reference,
            price: input.price,
            message: input.message,
            notes: input.notes ?? null,
            durationMin: input.durationMin ?? null,
            proposedDate: input.proposedDate ?? null,
            proposedTime: input.proposedTime ?? null,
            serviceId: input.serviceId ?? null,
            status: "PENDING",
            isValidUntil: validUntil,
            respondedAt: now,
            professionalProfileId: profile.id,
          },
          include: OFFER_INCLUDE,
        })
      : await tx.offer.create({
          data: {
            reference,
            requestId,
            professionalId: actor.id,
            professionalProfileId: profile.id,
            serviceId: input.serviceId ?? null,
            price: input.price,
            message: input.message,
            notes: input.notes ?? null,
            durationMin: input.durationMin ?? null,
            proposedDate: input.proposedDate ?? null,
            proposedTime: input.proposedTime ?? null,
            status: "PENDING",
            isValidUntil: validUntil,
            respondedAt: now,
          },
          include: OFFER_INCLUDE,
        });

    await tx.serviceRequest.update({
      where: { id: requestId },
      data: {
        offersCount: { increment: 1 },
        ...(fresh.status === "OPEN" ? { status: "RECEIVING_OFFERS" as const } : {}),
      },
    });

    // Rolling reply-time metric: how long after the request was posted did this
    // professional respond? Cheap to compute here, expensive to backfill.
    const posted = await tx.serviceRequest.findUnique({ where: { id: requestId }, select: { createdAt: true } });
    if (posted) {
      const minutes = Math.max(1, Math.round((now.getTime() - posted.createdAt.getTime()) / 60000));
      const nextMedian = Math.round((profile.responseTimeMin * 3 + Math.min(minutes, 4320)) / 4);
      await tx.professionalProfile.update({
        where: { id: profile.id },
        data: { responseTimeMin: Math.max(1, nextMedian) },
      });
    }

    await tx.notification.create({
      data: {
        userId: request.customerId,
        type: "NEW_OFFER",
        title: "عرض جديد على طلبك",
        body: `${request.title} — ${input.price} د.م.`,
        data: { requestId, requestReference: request.reference, offerId: created.id, offerReference: reference, amount: input.price },
        linkTo: `/dashboard/requests/${requestId}`,
        channels: { inApp: "sent", email: "skipped", push: "skipped" },
      },
    });

    return created;
  });

  return offer;
}

export async function updateOffer(actor: Actor, id: string, input: UpdateOfferInput) {
  const existing = await prisma.offer.findUnique({ where: { id }, select: { id: true, professionalId: true, status: true, requestId: true } });
  if (!existing) throw notFound("Offer not found.");
  if (!canManageOffer(actor, existing)) throw forbidden();
  if (existing.status !== "PENDING") throw unprocessable("Only a pending offer can be edited.");

  const data: Prisma.OfferUpdateInput = {};
  if (input.price !== undefined) data.price = input.price;
  if (input.message !== undefined) data.message = input.message;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.durationMin !== undefined) data.durationMin = input.durationMin;
  if (input.proposedDate !== undefined) data.proposedDate = input.proposedDate;
  if (input.proposedTime !== undefined) data.proposedTime = input.proposedTime;
  if (input.validUntil !== undefined) data.isValidUntil = input.validUntil;

  return prisma.offer.update({ where: { id }, data, include: OFFER_INCLUDE });
}

export async function withdrawOffer(actor: Actor, id: string) {
  const existing = await prisma.offer.findUnique({
    where: { id },
    select: { id: true, professionalId: true, status: true, requestId: true, request: { select: { customerId: true, reference: true, title: true } } },
  });
  if (!existing) throw notFound("Offer not found.");
  if (!canManageOffer(actor, existing)) throw forbidden();
  if (existing.status !== "PENDING") throw unprocessable("Only a pending offer can be withdrawn.");

  const [offer] = await prisma.$transaction([
    prisma.offer.update({
      where: { id },
      data: { status: "WITHDRAWN", respondedAt: new Date(), decidedAt: new Date(), decidedById: actor!.id },
      include: OFFER_INCLUDE,
    }),
    prisma.serviceRequest.update({ where: { id: existing.requestId }, data: { offersCount: { decrement: 1 } } }),
  ]);

  await createNotifications([
    {
      userId: existing.request.customerId,
      type: "OFFER_WITHDRAWN",
      role: "CUSTOMER",
      title: "تم سحب عرض",
      body: `${existing.request.title}`,
      data: { offerId: id, requestId: existing.requestId, requestReference: existing.request.reference },
      linkTo: `/dashboard/requests/${existing.requestId}`,
    },
  ]).catch(() => undefined);

  return offer;
}

/** Customer declines one offer but keeps the request open. */
export async function rejectOffer(actor: Actor, id: string) {
  const offer = await prisma.offer.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      professionalId: true,
      requestId: true,
      request: { select: { id: true, customerId: true, status: true, title: true, reference: true } },
    },
  });
  if (!offer) throw notFound("Offer not found.");
  if (!canDecideOffer(actor, offer.request)) throw forbidden();
  if (offer.status !== "PENDING") throw unprocessable("This offer is no longer pending.");

  const [updated] = await prisma.$transaction([
    prisma.offer.update({
      where: { id },
      data: { status: "REJECTED", respondedAt: new Date(), decidedAt: new Date(), decidedById: actor!.id },
    }),
    prisma.serviceRequest.update({ where: { id: offer.requestId }, data: { offersCount: { decrement: 1 } } }),
  ]);

  await createNotifications([
    {
      userId: offer.professionalId,
      type: "OFFER_REJECTED",
      role: "PROFESSIONAL",
      title: "تم رفض عرضك",
      body: `${offer.request.title}`,
      data: { offerId: id, requestId: offer.requestId, requestReference: offer.request.reference },
      linkTo: "/professional/offers",
    },
  ]).catch(() => undefined);

  return updated;
}

// ─── The critical workflow ───────────────────────────────────────────────────

export interface AcceptOfferResult {
  offerId: string;
  bookingId: string;
  bookingReference: string;
  requestStatus: string;
  closedOfferCount: number;
}

/**
 * Accept an offer → create the booking.
 *
 * Runs at SERIALIZABLE isolation with a second, in-transaction validation
 * pass, so two simultaneous "accept" clicks (or two browser tabs) can never
 * produce two bookings for one request.
 */
function isWriteConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function acceptOffer(actor: Actor, offerId: string): Promise<AcceptOfferResult> {
  if (!actor) throw forbidden();

  const preFlight = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      status: true,
      price: true,
      requestId: true,
      professionalId: true,
      proposedDate: true,
      proposedTime: true,
      durationMin: true,
      request: {
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          customerId: true,
          city: true,
          neighborhood: true,
          address: true,
          serviceId: true,
          preferredDate: true,
          preferredTime: true,
        },
      },
    },
  });
  if (!preFlight) throw notFound("Offer not found.");
  if (!canDecideOffer(actor, preFlight.request)) throw forbidden();

  const run = () => prisma.$transaction(
    async (tx): Promise<AcceptOfferResult> => {
      // 1. Re-read both rows inside the transaction — state may have changed.
      const offer = await tx.offer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          status: true,
          price: true,
          requestId: true,
          professionalId: true,
          professionalProfileId: true,
          serviceId: true,
          proposedDate: true,
          proposedTime: true,
          durationMin: true,
          isValidUntil: true,
          request: {
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              customerId: true,
              city: true,
              neighborhood: true,
              address: true,
              serviceId: true,
              preferredDate: true,
              preferredTime: true,
            },
          },
        },
      });
      if (!offer) throw notFound("Offer not found.");

      // 2. Ownership — never trust the client.
      if (actor.role !== "ADMIN" && offer.request.customerId !== actor.id) {
        throw forbidden("You can only accept offers on your own request.");
      }

      // 3. Offer still available?
      if (offer.status === "ACCEPTED") throw conflict("This offer has already been accepted.");
      if (offer.status === "WITHDRAWN") throw unprocessable("This offer was withdrawn by the professional.");
      if (offer.status === "EXPIRED") throw unprocessable("This offer has expired.");
      if (offer.status !== "PENDING") throw unprocessable("This offer is no longer available.");
      if (offer.isValidUntil && offer.isValidUntil < new Date()) {
        throw unprocessable("This offer has expired.");
      }

      // 4. Request still open for a decision?
      if (!["OPEN", "RECEIVING_OFFERS"].includes(offer.request.status)) {
        throw conflict("This request already has an accepted offer.");
      }
      if (!REQUEST_TRANSITIONS[offer.request.status]?.includes("OFFER_SELECTED")) {
        throw unprocessable("This request cannot accept an offer in its current state.");
      }

      // 5. Idempotency guard: one booking per request, one per offer.
      const existingBooking = await tx.booking.findFirst({
        where: { requestId: offer.requestId },
        select: { id: true, reference: true },
      });
      if (existingBooking) {
        throw conflict(`A booking (${existingBooking.reference}) already exists for this request.`);
      }

      // 6. Close competing offers (ids captured first so notifications are exact).
      const competingOffers = await tx.offer.findMany({
        where: { requestId: offer.requestId, id: { not: offer.id }, status: "PENDING" },
        select: { id: true, professionalId: true },
      });
      const competing = await tx.offer.updateMany({
        where: { id: { in: competingOffers.map((o) => o.id) } },
        data: { status: "REJECTED", respondedAt: new Date(), decidedAt: new Date(), decidedById: actor.id },
      });
      void competing;

      // 7. Mark this offer accepted.
      await tx.offer.update({
        where: { id: offer.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
          decidedAt: new Date(),
          decidedById: actor.id,
        },
      });

      // 8. Create the booking. Price/duration come from the *stored* offer,
      //    never from the request body.
      const bookingReference = await (async () => {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const candidate = makeReference("BKG");
          const exists = await tx.booking.findUnique({ where: { reference: candidate }, select: { id: true } });
          if (!exists) return candidate;
        }
        return makeReference("BKG", 8);
      })();

      const scheduledDate =
        offer.proposedDate ??
        offer.request.preferredDate ??
        new Date(Date.now() + 24 * 60 * 60 * 1000);

      const booking = await tx.booking.create({
        data: {
          reference: bookingReference,
          customerId: offer.request.customerId,
          professionalId: offer.professionalId,
          requestId: offer.requestId,
          offerId: offer.id,
          serviceId: offer.serviceId ?? offer.request.serviceId,
          title: offer.request.title,
          status: "PENDING",
          scheduledDate,
          scheduledTime: offer.proposedTime ?? offer.request.preferredTime ?? "09:00-12:00",
          city: offer.request.city,
          neighborhood: offer.request.neighborhood,
          address: offer.request.address ?? offer.request.city,
          price: offer.price,
          currency: "MAD",
          durationMin: offer.durationMin,
          notes: null,
          paymentStatus: "UNPAID",
          paymentMethod: "CASH",
          statusHistory: {
            create: { to: "PENDING", changedBy: actor.id, reason: "Offer accepted by customer" },
          },
        },
        select: { id: true, reference: true, status: true, scheduledDate: true, scheduledTime: true },
      });

      // 9. Advance the request.
      await tx.serviceRequest.update({
        where: { id: offer.requestId },
        data: {
          status: "OFFER_SELECTED",
          selectedOfferId: offer.id,
          bookingId: booking.id,
        },
      });

      // 10. Notify both parties (plus the rejected professionals).
      const notifications: CreateNotificationInput[] = [
        {
          userId: offer.request.customerId,
          type: "BOOKING_CREATED",
          role: "CUSTOMER",
          title: "تم إنشاء حجزك",
          body: `${offer.request.title} — ${offer.price} د.م. (المرجع ${booking.reference})`,
          data: {
            bookingId: booking.id,
            bookingReference: booking.reference,
            requestId: offer.requestId,
            offerId: offer.id,
            amount: offer.price,
          },
          linkTo: `/dashboard/bookings/${booking.id}`,
        },
        {
          userId: offer.professionalId,
          type: "OFFER_ACCEPTED",
          role: "PROFESSIONAL",
          title: "قبل العميل عرضك",
          body: `${offer.request.title} — ${offer.price} د.م. المرجو تأكيد الحجز.`,
          data: {
            bookingId: booking.id,
            bookingReference: booking.reference,
            requestId: offer.requestId,
            offerId: offer.id,
            amount: offer.price,
          },
          linkTo: `/professional/bookings/${booking.id}`,
        },
        ...competingOffers
          .filter((o) => o.professionalId !== offer.professionalId)
          .map((o) => ({
            userId: o.professionalId,
            type: "OFFER_REJECTED" as const,
            role: "PROFESSIONAL" as const,
            title: "تم اختيار عرض آخر",
            body: `${offer.request.title}`,
            data: { requestId: offer.requestId, offerId: o.id, requestReference: offer.request.reference },
            linkTo: "/professional/offers",
          })),
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

      // 11. Audit trail.
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "OFFER_ACCEPTED",
          targetType: "OFFER",
          targetId: offer.id,
          metadata: {
            requestId: offer.requestId,
            bookingId: booking.id,
            price: offer.price,
            closedOffers: competing.count,
          },
        },
      });

      return {
        offerId: offer.id,
        bookingId: booking.id,
        bookingReference: booking.reference,
        requestStatus: "OFFER_SELECTED",
        closedOfferCount: competing.count,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 15_000,
    }
  );

  // Two tabs can lose the serializable race. Retry so the loser re-reads the
  // committed booking and returns a business conflict instead of a raw 500.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (!isWriteConflict(error) || attempt === 3) throw error;
    }
  }
  throw new Error("acceptOffer retry exhausted");
}

/** Closes PENDING offers whose validity window has passed. Cron-safe. */
export async function expireStaleOffers(batchSize = 200) {
  const now = new Date();
  const result = await prisma.offer.updateMany({
    where: { status: "PENDING", isValidUntil: { lt: now } },
    data: { status: "EXPIRED" },
  });
  void batchSize;
  return { expired: result.count };
}
