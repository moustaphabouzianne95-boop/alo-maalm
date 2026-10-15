import { randomInt } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiError, ErrorCode } from "@/lib/api/errors";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { makeReference } from "@/lib/utils";
import { loginUser, registerUser } from "@/server/auth/service";
import { transitionBooking } from "@/server/bookings/service";
import { acceptOffer, createOffer, type CreateOfferInput } from "@/server/offers/service";
import { createReviewForBooking } from "@/server/reviews/service";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

function uniquePhone() {
  return `+2126${randomInt(0, 100_000_000).toString().padStart(8, "0")}`;
}

async function expectStatus(run: () => Promise<unknown>, status: number, code?: string) {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.status).toBe(status);
    if (code) expect(api.code).toBe(code);
    return api;
  }
  throw new Error(`expected an ApiError with status ${status}`);
}

const offerInput: CreateOfferInput = {
  price: 250,
  message: "يمكنني إنجاز العمل غداً صباحاً مع القطع الأساسية.",
  notes: null,
  durationMin: 90,
  proposedDate: null,
  proposedTime: null,
  serviceId: null,
  validUntil: null,
};

describe("auth boundaries", () => {
  const createdUserIds: string[] = [];

  afterAll(async () => {
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("refuses to register an administrator", async () => {
    await expectStatus(
      () =>
        registerUser({
          firstName: "مشرف",
          lastName: "مرفوض",
          email: `admin-self-${Date.now()}@alomaalem.test`,
          phone: uniquePhone(),
          password: "Demo@12345",
          role: "ADMIN",
        }),
      403,
      ErrorCode.FORBIDDEN
    );
  });

  it("returns the same login failure for an unknown account and a wrong password", async () => {
    const unknown = await expectStatus(
      () => loginUser({ identifier: "nobody-here@alomaalem.test", password: "Demo@12345" }),
      401,
      ErrorCode.UNAUTHENTICATED
    );
    const wrong = await expectStatus(
      () => loginUser({ identifier: "admin@alomaalem.ma", password: "not-the-demo-password" }),
      401,
      ErrorCode.UNAUTHENTICATED
    );
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.message).toBe("Incorrect email or password.");
  });

  it("locks a suspended account instead of signing it in", async () => {
    const password = "Demo@12345";
    const email = `suspended-${Date.now()}@alomaalem.test`;
    const user = await prisma.user.create({
      data: {
        email,
        phone: uniquePhone(),
        passwordHash: await hashPassword(password),
        role: "CUSTOMER",
        status: "SUSPENDED",
        identity: { create: { firstName: "حساب", lastName: "موقوف", fullName: "حساب موقوف", city: "Oujda" } },
      },
    });
    createdUserIds.push(user.id);

    await expectStatus(() => loginUser({ identifier: email, password }), 423, ErrorCode.LOCKED);
    const sessions = await prisma.session.count({ where: { userId: user.id } });
    expect(sessions).toBe(0);
  });
});

describe("offer acceptance, booking roles, and reviews", () => {
  const userIds: string[] = [];
  const requestIds: string[] = [];
  let customer: { id: string; role: "CUSTOMER" };
  let outsider: { id: string; role: "CUSTOMER" };
  let proA: { id: string; role: "PROFESSIONAL" };
  let proB: { id: string; role: "PROFESSIONAL" };
  let categoryId = "";

  beforeAll(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    if (!category) throw new Error("Seed a category before running workflow tests.");
    categoryId = category.id;

    async function makeUser(role: "CUSTOMER" | "PROFESSIONAL", label: string) {
      const stamp = `${Date.now().toString(36)}-${randomInt(1000, 9999)}`;
      const user = await prisma.user.create({
        data: {
          email: `${label}-${stamp}@alomaalem.test`,
          phone: uniquePhone(),
          passwordHash: "not-a-login",
          role,
          status: "ACTIVE",
          identity: {
            create: { firstName: label, lastName: "اختبار", fullName: `${label} اختبار`, city: "Oujda" },
          },
          ...(role === "PROFESSIONAL"
            ? {
                professionalProfile: {
                  create: {
                    slug: `${label}-${stamp}`,
                    businessName: `${label} للخدمات`,
                    city: "Oujda",
                    verificationStatus: "VERIFIED",
                  },
                },
              }
            : {}),
        },
        select: { id: true, role: true },
      });
      userIds.push(user.id);
      return user;
    }

    const [c, o, a, b] = await Promise.all([
      makeUser("CUSTOMER", "customer"),
      makeUser("CUSTOMER", "outsider"),
      makeUser("PROFESSIONAL", "pro-a"),
      makeUser("PROFESSIONAL", "pro-b"),
    ]);
    customer = { id: c.id, role: "CUSTOMER" };
    outsider = { id: o.id, role: "CUSTOMER" };
    proA = { id: a.id, role: "PROFESSIONAL" };
    proB = { id: b.id, role: "PROFESSIONAL" };
  });

  afterAll(async () => {
    if (requestIds.length) {
      const bookings = await prisma.booking.findMany({
        where: { requestId: { in: requestIds } },
        select: { id: true },
      });
      const bookingIds = bookings.map((row) => row.id);
      if (bookingIds.length) {
        await prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }
      await prisma.conversation.deleteMany({
        where: {
          OR: [
            { requestId: { in: requestIds } },
            { customerId: { in: userIds } },
            { professionalId: { in: userIds } },
          ],
        },
      });
      await prisma.offer.deleteMany({ where: { requestId: { in: requestIds } } });
      await prisma.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
    }
    if (userIds.length) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  async function openRequest(title: string) {
    const request = await prisma.serviceRequest.create({
      data: {
        reference: makeReference("REQ"),
        customerId: customer.id,
        categoryId,
        title,
        description: "طلب اختبار يُحذف في نهاية الملف. لا يظهر في البيانات التجريبية.",
        city: "Oujda",
        neighborhood: "لازاري",
        address: "حي لازاري، وجدة",
        status: "RECEIVING_OFFERS",
        maxOffers: 5,
        offersCount: 0,
        currency: "MAD",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    requestIds.push(request.id);
    return request;
  }

  async function pendingOffer(requestId: string, professionalId: string, price: number) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId: professionalId },
      select: { id: true },
    });
    return prisma.offer.create({
      data: {
        reference: makeReference("OFR"),
        requestId,
        professionalId,
        professionalProfileId: profile?.id,
        price,
        currency: "MAD",
        message: "عرض اختبار بسعر ثابت بالدرهم، يشمل المعاينة والعمل.",
        status: "PENDING",
        durationMin: 90,
      },
    });
  }

  it("blocks customers from submitting offers", async () => {
    await expectStatus(
      () => createOffer(customer, "00000000-0000-4000-8000-000000000001", offerInput),
      403,
      ErrorCode.FORBIDDEN
    );
  });

  it("accepts one offer in a transaction and closes the competing offer", async () => {
    const request = await openRequest("إصلاح تسرب في المطبخ");
    const chosen = await pendingOffer(request.id, proA.id, 450);
    const competing = await pendingOffer(request.id, proB.id, 390);
    await prisma.serviceRequest.update({ where: { id: request.id }, data: { offersCount: 2 } });

    await expectStatus(() => acceptOffer(outsider, chosen.id), 403, ErrorCode.FORBIDDEN);
    await expectStatus(() => acceptOffer(proA, chosen.id), 403, ErrorCode.FORBIDDEN);

    const accepted = await acceptOffer(customer, chosen.id);
    expect(accepted.bookingReference).toMatch(/^BKG-/);
    expect(accepted.requestStatus).toBe("OFFER_SELECTED");

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: accepted.bookingId } });
    expect(booking.price).toBe(450);
    expect(booking.currency).toBe("MAD");
    expect(booking.customerId).toBe(customer.id);
    expect(booking.professionalId).toBe(proA.id);
    expect(booking.offerId).toBe(chosen.id);

    const offers = await prisma.offer.findMany({ where: { requestId: request.id } });
    expect(offers.find((row) => row.id === chosen.id)?.status).toBe("ACCEPTED");
    expect(offers.find((row) => row.id === competing.id)?.status).toBe("REJECTED");

    const updated = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(updated.status).toBe("OFFER_SELECTED");
    expect(updated.selectedOfferId).toBe(chosen.id);
    expect(await prisma.booking.count({ where: { requestId: request.id } })).toBe(1);

    await expectStatus(() => acceptOffer(customer, competing.id), 422, ErrorCode.UNPROCESSABLE);
    await expectStatus(() => acceptOffer(customer, chosen.id), 409, ErrorCode.CONFLICT);
    expect(await prisma.booking.count({ where: { requestId: request.id } })).toBe(1);
  });

  it("lets exactly one of two concurrent accepts win", async () => {
    const request = await openRequest("صباغة غرفة النوم");
    const first = await pendingOffer(request.id, proA.id, 800);
    const second = await pendingOffer(request.id, proB.id, 760);

    const settled = await Promise.allSettled([acceptOffer(customer, first.id), acceptOffer(customer, second.id)]);
    const won = settled.filter((row) => row.status === "fulfilled");
    const lost = settled.filter((row) => row.status === "rejected");
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);

    const bookings = await prisma.booking.findMany({ where: { requestId: request.id } });
    expect(bookings).toHaveLength(1);
    const statuses = await prisma.offer.findMany({
      where: { requestId: request.id },
      select: { status: true },
    });
    expect(statuses.map((row) => row.status).sort()).toEqual(["ACCEPTED", "REJECTED"]);
  });

  it("enforces who may complete a booking, then allows one review only", async () => {
    const request = await openRequest("تركيب مكيف");
    const offer = await pendingOffer(request.id, proA.id, 1200);
    const accepted = await acceptOffer(customer, offer.id);
    const bookingId = accepted.bookingId;

    await expectStatus(
      () => transitionBooking(customer, bookingId, { status: "CONFIRMED" }),
      403,
      ErrorCode.FORBIDDEN
    );
    await transitionBooking(proA, bookingId, { status: "CONFIRMED" });
    await transitionBooking(proA, bookingId, { status: "IN_PROGRESS" });

    await expectStatus(
      () => transitionBooking(proA, bookingId, { status: "COMPLETED" }),
      403,
      ErrorCode.FORBIDDEN
    );
    await expectStatus(
      () => createReviewForBooking(customer, bookingId, { rating: 5, comment: "عمل متقن وفي الوقت." }),
      422,
      ErrorCode.UNPROCESSABLE
    );

    await transitionBooking(customer, bookingId, { status: "COMPLETED" });
    const completed = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.completedAt).not.toBeNull();

    await expectStatus(
      () => createReviewForBooking(outsider, bookingId, { rating: 1, comment: "لست صاحب الحجز." }),
      403,
      ErrorCode.FORBIDDEN
    );
    await expectStatus(
      () => createReviewForBooking(proA, bookingId, { rating: 5, comment: "المعلم لا يقيّم نفسه." }),
      403,
      ErrorCode.FORBIDDEN
    );

    const review = await createReviewForBooking(customer, bookingId, {
      rating: 5,
      comment: "أنجز العمل في وجدة كما اتفقنا، والسعر كان 1200 درهم.",
    });
    expect(review.rating).toBe(5);
    expect(review.status).toBe("PUBLISHED");

    await expectStatus(
      () => createReviewForBooking(customer, bookingId, { rating: 4, comment: "محاولة تقييم ثانية." }),
      409,
      ErrorCode.CONFLICT
    );
    expect(await prisma.review.count({ where: { bookingId } })).toBe(1);
  });

  it("refuses a review on a cancelled booking", async () => {
    const request = await openRequest("إصلاح باب خشبي");
    const offer = await pendingOffer(request.id, proB.id, 300);
    const accepted = await acceptOffer(customer, offer.id);

    await transitionBooking(customer, accepted.bookingId, { status: "CANCELLED", reason: "ألغى الزبون الموعد." });
    await expectStatus(
      () => createReviewForBooking(customer, accepted.bookingId, { rating: 2, comment: "لا يجب أن يُقبل." }),
      422,
      ErrorCode.UNPROCESSABLE
    );
    expect(await prisma.review.count({ where: { bookingId: accepted.bookingId } })).toBe(0);
  });
});
