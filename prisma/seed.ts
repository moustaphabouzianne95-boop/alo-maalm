/* eslint-disable no-console */
/**
 * ألو المعلم · Alo Maalem — database seed (§34).
 *
 * Produces a coherent slice of a live marketplace: 1 admin, 10 customers,
 * 20 professionals (mixed verification states), 20 categories, 50 published
 * services, 55 requests, 60+ offers, 55 bookings, 40 reviews, 30 conversations
 * with 150+ messages, 50+ notifications, favorites, portfolio items and an
 * audit trail.
 *
 * Everything is written with explicit UUIDs so relations can be resolved in
 * memory instead of re-querying, and all denormalised counters (rating
 * averages, `offersCount`, `servicesCount`, `completedJobs`…) are recomputed
 * from the source rows at the end — the seed can never ship inconsistent
 * aggregates.
 *
 * Run with:  npm run db:seed
 * Destructive: it clears every table first. Never point it at production.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma, type OfferStatus, type DocumentType, type DocumentStatus, type RequestStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  CATEGORIES,
  SERVICES,
  CUSTOMERS,
  PROFESSIONALS,
  REQUESTS,
  OFFER_MESSAGES,
  OFFER_NOTES,
  CONVERSATIONS,
  EXTRA_REVIEWS,
  NOTIFICATION_SEEDS,
  FAVORITE_PAIRS,
  PORTFOLIO_ITEMS,
} from "./seed-data";

// ── Environment ──────────────────────────────────────────────────────────────
// `prisma.config.ts` loads dotenv for the CLI; running through tsx directly
// needs the same treatment so DATABASE_URL/SEED_PASSWORD are available.
function loadDotEnv() {
  if (process.env.DATABASE_URL) return;
  const file = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    const value = raw!.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw!.replace(/^'|'$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnv();

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD || "Demo@12345";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@alomaalem.ma";

// ── Deterministic randomness ─────────────────────────────────────────────────
let seedState = 20261008;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const intBetween = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const daysAgo = (days: number, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, intBetween(0, 59), 0, 0);
  return d;
};
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3600_000);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const daysAhead = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

function reference(prefix: string, n: number): string {
  return `${prefix}-${n.toString(36).toUpperCase().padStart(4, "0")}${Math.floor(rnd() * 1296).toString(36).toUpperCase().padStart(2, "0")}`;
}

function neighborhoodFor(city: string): string | null {
  const map: Record<string, string[]> = {
    casablanca: ["المعاريف", "أنفا", "عين الذئاب", "سيدي معروف", "الحي الحسني", "بن مسيك"],
    rabat: ["أكدال", "حسان", "السويسي", "يعقوب المنصور", "حي الرياض"],
    marrakech: ["جليز", "المدينة القديمة", "الحي الشتوي", "سيدي يوسف بن علي", "المحاميد"],
    tangier: ["ملابطا", "وسط المدينة", "بني مكادة", "الدرادب"],
    fes: ["النرجس", "السعادة", "المدينة العتيقة", "زواغة", "عين قادوس"],
    agadir: ["السلام", "حي الهدى", "فونتي", "تالبرجت"],
    meknes: ["حمرية", "المنزه", "تولال", "سيدي بوزكري"],
    oujda: ["وسط المدينة", "حي النصر", "لاسفواي", "حي السلام"],
    kenitra: ["وسط المدينة", "حي النهضة", "أولاد اوجيه", "معمورة"],
    tetouan: ["الطوابل", "وسط المدينة", "حي النسيم", "سانية الرمل"],
    safi: ["وسط المدينة", "حي النهضة", "سيدي بوزيد"],
    "el-jadida": ["وسط المدينة", "حي السلام", "الغزوة"],
    nador: ["وسط المدينة", "بني أنصار", "حي المطار"],
    "beni-mellal": ["وسط المدينة", "حي النهضة"],
    khouribga: ["وسط المدينة", "حي المسيرة"],
    settat: ["وسط المدينة", "حي النهضة"],
  };
  const list = map[city];
  return list ? pick(list) : null;
}

function fullName(first: string, last: string) {
  return `${first} ${last}`.trim();
}

function log(step: string, detail?: string) {
  console.log(`  \x1b[36m▸\x1b[0m ${step}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ""}`);
}

// ── Wipe ─────────────────────────────────────────────────────────────────────
async function wipe() {
  log("Clearing existing data");
  // Order matters: children before parents, and `Restrict` relations first.
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.requestImage.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.report.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.portfolioItem.deleteMany();
  await prisma.verificationDocument.deleteMany();
  await prisma.serviceArea.deleteMany();
  await prisma.serviceImage.deleteMany();
  await prisma.service.deleteMany();
  await prisma.professionalProfile.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const startedAt = Date.now();
  console.log("\n\x1b[1mألو المعلم · seeding the database\x1b[0m\n");

  if (process.env.NODE_ENV === "production" && !process.env.SEED_ALLOW_PRODUCTION) {
    throw new Error("Refusing to seed with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=1 to override.");
  }

  await wipe();

  // One bcrypt hash reused by every demo account: identical plaintext, and
  // hashing 30+ times at cost 12 would add minutes to every seed run.
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  // ── Categories ────────────────────────────────────────────────────────────
  log("Creating categories", `${CATEGORIES.length}`);
  const categories = CATEGORIES.map((c, index) => ({
    id: randomUUID(),
    slug: c.slug,
    name: c.ar,
    nameFr: c.fr,
    nameEn: c.en,
    description: c.descAr,
    descriptionFr: c.descFr,
    descriptionEn: c.descEn,
    icon: c.icon,
    color: c.color,
    sortOrder: index + 1,
    isActive: true,
    createdAt: daysAgo(400 + index),
  }));
  await prisma.category.createMany({ data: categories });
  const categoryId = new Map(categories.map((c) => [c.slug, c.id]));

  // ── Users ─────────────────────────────────────────────────────────────────
  log("Creating the administrator", ADMIN_EMAIL);
  const admin = {
    id: randomUUID(),
    email: ADMIN_EMAIL,
    phone: "+212661000000",
    passwordHash,
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    emailVerified: daysAgo(300),
    phoneVerified: daysAgo(300),
    locale: "AR" as const,
    lastLoginAt: hoursAgo(5),
    createdAt: daysAgo(320),
  };
  await prisma.user.create({ data: admin });
  await prisma.profile.create({
    data: {
      userId: admin.id,
      firstName: "إدارة",
      lastName: "ألو المعلم",
      fullName: "إدارة ألو المعلم",
      city: "casablanca",
      bio: "الحساب الإداري للمنصة.",
    },
  });

  log("Creating customers", `${CUSTOMERS.length}`);
  const customers = CUSTOMERS.map((c, index) => ({
    id: randomUUID(),
    email: c.email,
    phone: c.phone,
    passwordHash,
    role: "CUSTOMER" as const,
    status: "ACTIVE" as const,
    emailVerified: index < 8 ? daysAgo(200 - index * 7) : null,
    locale: (index % 5 === 0 ? "FR" : "AR") as "AR" | "FR",
    lastLoginAt: hoursAgo(intBetween(2, 300)),
    createdAt: daysAgo(250 - index * 12),
  }));
  await prisma.user.createMany({ data: customers });
  await prisma.profile.createMany({
    data: customers.map((u, i) => ({
      userId: u.id,
      firstName: CUSTOMERS[i]!.firstName,
      lastName: CUSTOMERS[i]!.lastName,
      fullName: fullName(CUSTOMERS[i]!.firstName, CUSTOMERS[i]!.lastName),
      city: CUSTOMERS[i]!.city,
      avatarUrl: null,
    })),
  });
  await prisma.customerProfile.createMany({
    data: customers.map((u, i) => ({
      userId: u.id,
      defaultCity: CUSTOMERS[i]!.city,
      defaultNeighborhood: neighborhoodFor(CUSTOMERS[i]!.city),
      notifyByEmail: true,
      notifyByPhone: i % 3 === 0,
      notifyByWhatsapp: i % 4 === 0,
    })),
  });

  log("Creating professionals", `${PROFESSIONALS.length}`);
  const professionalUsers = PROFESSIONALS.map((p, index) => ({
    id: randomUUID(),
    email: p.email,
    phone: p.phone,
    passwordHash,
    role: "PROFESSIONAL" as const,
    status: p.verification === "SUSPENDED" ? ("SUSPENDED" as const) : ("ACTIVE" as const),
    emailVerified: p.verification === "PENDING" ? null : daysAgo(180 - index * 5),
    locale: (index % 4 === 0 ? "FR" : "AR") as "AR" | "FR",
    lastLoginAt: hoursAgo(intBetween(1, 400)),
    createdAt: daysAgo(220 - index * 8),
  }));
  await prisma.user.createMany({ data: professionalUsers });
  await prisma.profile.createMany({
    data: professionalUsers.map((u, i) => ({
      userId: u.id,
      firstName: PROFESSIONALS[i]!.firstName,
      lastName: PROFESSIONALS[i]!.lastName,
      fullName: fullName(PROFESSIONALS[i]!.firstName, PROFESSIONALS[i]!.lastName),
      city: PROFESSIONALS[i]!.city,
    })),
  });

  const professionalProfiles = PROFESSIONALS.map((p, i) => ({
    id: randomUUID(),
    userId: professionalUsers[i]!.id,
    slug: p.slug,
    businessName: p.businessName,
    headline: p.headlineAr,
    about: p.aboutAr,
    city: p.city,
    neighborhood: neighborhoodFor(p.city),
    serviceRadiusKm: intBetween(15, 60),
    yearsExperience: p.yearsExperience,
    languages: p.languages,
    website: i % 5 === 0 ? `https://${p.slug}.ma` : null,
    phonePublic: i % 6 === 0,
    publicPhone: i % 6 === 0 ? p.phone : null,
    verificationStatus: p.verification,
    verifiedAt: p.verification === "VERIFIED" ? daysAgo(150 - i * 4) : null,
    verifiedBy: p.verification === "VERIFIED" ? admin.id : null,
    verificationMethod: p.verification === "VERIFIED" ? ("MANUAL" as const) : null,
    verificationNote:
      p.verification === "REJECTED"
        ? "صورة بطاقة التعريف غير واضحة — يرجى إعادة رفع وثيقة مقروءة."
        : p.verification === "SUSPENDED"
          ? "شكايات متكررة من عملاء بخصوص عدم الحضور في الموعد."
          : null,
    availabilityStatus:
      p.verification === "SUSPENDED" ? ("UNAVAILABLE" as const) : i % 7 === 0 ? ("BUSY" as const) : ("AVAILABLE" as const),
    availability: {
      monday: { morning: true, afternoon: true },
      tuesday: { morning: true, afternoon: true },
      wednesday: { morning: true, afternoon: false },
      thursday: { morning: true, afternoon: true },
      friday: { morning: true, afternoon: false },
      saturday: { morning: true, afternoon: true },
      sunday: { morning: false, afternoon: false },
    } as Prisma.InputJsonValue,
    acceptsUrgentJobs: i % 3 !== 0,
    isFeatured: Boolean(p.featured),
    profileViews: intBetween(120, 4200),
    responseTimeMin: intBetween(12, 240),
    createdAt: daysAgo(200 - i * 7),
  }));
  await prisma.professionalProfile.createMany({ data: professionalProfiles });

  // Primary service areas + a couple of secondary ones for larger pros.
  const serviceAreas: Prisma.ServiceAreaCreateManyInput[] = professionalProfiles.flatMap((profile, i) => [
    {
      id: randomUUID(),
      professionalId: profile.id,
      serviceId: null,
      city: profile.city,
      neighborhood: null,
      radiusKm: profile.serviceRadiusKm,
      travelFee: 0,
      isPrimary: true,
    },
    ...(i % 3 === 0
      ? [
          {
            id: randomUUID(),
            professionalId: profile.id,
            serviceId: null,
            city: pick(["casablanca", "rabat", "marrakech", "tangier", "fes"]),
            neighborhood: null,
            radiusKm: 25,
            travelFee: intBetween(50, 200),
            isPrimary: false,
          },
        ]
      : []),
  ]);
  await prisma.serviceArea.createMany({ data: serviceAreas });

  log("Creating verification documents");
  const documents: Prisma.VerificationDocumentCreateManyInput[] = [];
  professionalProfiles.forEach((profile, i) => {
    const push = (doc: Prisma.VerificationDocumentCreateManyInput) => documents.push(doc);
    if (PROFESSIONALS[i]!.verification === "PENDING") {
      push(
        {
          id: randomUUID(),
          userId: profile.userId,
          professionalId: profile.id,
          type: "CIN" as DocumentType,
          status: "PENDING" as DocumentStatus,
          fileUrl: `/uploads/documents/cin-${i + 1}.jpg`,
          fileName: `carte-identite-${i + 1}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: intBetween(200_000, 2_000_000),
          createdAt: daysAgo(intBetween(2, 20)),
        });
      return;
    }
    if (PROFESSIONALS[i]!.verification === "VERIFIED") {
      push(
        {
          id: randomUUID(),
          userId: profile.userId,
          professionalId: profile.id,
          type: "CIN" as const,
          status: "APPROVED" as const,
          fileUrl: `/uploads/documents/cin-${i + 1}.jpg`,
          fileName: `carte-identite-${i + 1}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: intBetween(200_000, 2_000_000),
          maskedNumber: `******${intBetween(100, 999)}`,
          reviewedById: admin.id,
          reviewedAt: daysAgo(150 - i * 4),
          expiresAt: daysAhead(1200),
          createdAt: daysAgo(160 - i * 4),
        });
      if (i % 4 === 0) {
        push({
          id: randomUUID(),
          userId: profile.userId,
          professionalId: profile.id,
          type: "BUSINESS_REGISTRATION",
          status: "APPROVED",
          fileUrl: `/uploads/documents/patente-${i + 1}.pdf`,
          fileName: `patente-${i + 1}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: intBetween(150_000, 900_000),
          reviewedById: admin.id,
          reviewedAt: daysAgo(150 - i * 4),
          createdAt: daysAgo(160 - i * 4),
        });
      }
      return;
    }
    if (PROFESSIONALS[i]!.verification === "REJECTED") {
      push(
        {
          id: randomUUID(),
          userId: profile.userId,
          professionalId: profile.id,
          type: "CIN" as const,
          status: "REJECTED" as const,
          fileUrl: `/uploads/documents/cin-${i + 1}.jpg`,
          fileName: `carte-identite-${i + 1}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: intBetween(90_000, 400_000),
          reviewedById: admin.id,
          reviewedAt: daysAgo(40),
          rejectionReason: "الصورة غير مقروءة — يرجى إعادة التصوير بإضاءة جيدة.",
          createdAt: daysAgo(45),
        });
    }
  });
  await prisma.verificationDocument.createMany({ data: documents });

  // ── Services ──────────────────────────────────────────────────────────────
  log("Creating services", `${SERVICES.length}`);
  /** Distribute services across professionals that cover the category. */
  const professionalIdForCategory = (categorySlug: string, fallbackIndex: number) => {
    const candidates = professionalProfiles
      .map((profile, index) => ({ profile, index }))
      .filter(({ index }) => PROFESSIONALS[index]!.categories.includes(categorySlug));
    const chosen = candidates.length ? candidates[fallbackIndex % candidates.length]! : { profile: professionalProfiles[fallbackIndex % professionalProfiles.length]!, index: fallbackIndex % professionalProfiles.length };
    return chosen;
  };

  const services = SERVICES.map((s, index) => {
    const { profile, index: proIndex } = professionalIdForCategory(s.category, index);
    const status = PROFESSIONALS[proIndex]!.verification === "SUSPENDED" ? ("HIDDEN" as const) : index % 17 === 0 ? ("PAUSED" as const) : ("PUBLISHED" as const);
    return {
      id: randomUUID(),
      slug: `${s.category}-${index + 1}-${Math.floor(rnd() * 9000 + 1000)}`,
      title: s.titleAr,
      titleFr: s.titleFr,
      titleEn: s.titleEn,
      description: s.descAr,
      descriptionFr: s.descFr,
      descriptionEn: s.descEn,
      categoryId: categoryId.get(s.category)!,
      professionalId: profile.id,
      ownerUserId: profile.userId,
      status,
      pricingType: s.pricing,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      currency: "MAD",
      durationMin: s.durationMin,
      durationMax: s.durationMax,
      durationUnit: s.durationUnit,
      city: PROFESSIONALS[proIndex]!.city,
      neighborhood: profile.neighborhood,
      coverImage: null,
      keywords: s.keywords,
      includes: s.includes,
      warrantyDays: s.warranty,
      isUrgentAvailable: Boolean(s.urgent),
      viewsCount: intBetween(40, 3200),
      isFeatured: index % 9 === 0,
      publishedAt: status === "PUBLISHED" ? daysAgo(180 - (index % 180)) : null,
      createdAt: daysAgo(190 - (index % 190)),
    };
  });
  await prisma.service.createMany({ data: services });

  // Per-service coverage areas.
  await prisma.serviceArea.createMany({
    data: services.map((s) => ({
      id: randomUUID(),
      professionalId: s.professionalId,
      serviceId: s.id,
      city: s.city,
      neighborhood: s.neighborhood,
      radiusKm: 20,
      travelFee: intBetween(0, 100),
      isPrimary: false,
    })),
  });

  // ── Portfolio ─────────────────────────────────────────────────────────────
  log("Creating portfolio items", `${PORTFOLIO_ITEMS.length}`);
  await prisma.portfolioItem.createMany({
    data: PORTFOLIO_ITEMS.map((item, index) => ({
      id: randomUUID(),
      professionalId: professionalProfiles[item.professional]!.id,
      title: item.titleAr,
      description: item.descAr,
      imageUrl: `/uploads/portfolio/work-${index + 1}.jpg`,
      city: item.city,
      completedAt: daysAgo(intBetween(60, 700)),
      sortOrder: index,
      isPublic: true,
      createdAt: daysAgo(intBetween(30, 600)),
    })),
  });

  // ── Requests ──────────────────────────────────────────────────────────────
  // ── Follow-up demand ──────────────────────────────────────────────────────
  // Real marketplaces are full of repeat business: the same customer calling
  // the same professional back months later. These requests give every extra
  // review a completed booking of its own (one review per booking is a hard
  // rule), and they push the dataset past the spec minimums.
  const FOLLOW_UP_TITLES: [string, string][] = [
    ["زيارة صيانة دورية بعد التدخل السابق", "Suivi d'entretien après la première intervention"],
    ["أشغال صغيرة إضافية في نفس المكان", "Petits travaux supplémentaires au même endroit"],
    ["فحص سنوي متفق عليه مسبقاً", "Contrôle annuel convenu à l'avance"],
    ["تدخل ثانٍ لإتمام ما تبقى", "Seconde intervention pour terminer le reste"],
    ["صيانة وقائية قبل الموسم", "Entretien préventif avant la saison"],
    ["إصلاح عطل ظهر بعد الأشغال", "Réparation d'un défaut apparu après les travaux"],
    ["توسيع العمل إلى غرفة أخرى", "Extension du travail à une autre pièce"],
    ["عقد صيانة شهري", "Contrat d'entretien mensuel"],
  ];

  const followUpRequests = EXTRA_REVIEWS.map((rev, index) => {
    const customer = CUSTOMERS[rev.customer]!;
    const professional = PROFESSIONALS[rev.professional]!;
    const [titleAr] = FOLLOW_UP_TITLES[index % FOLLOW_UP_TITLES.length]!;
    return {
      customer: rev.customer,
      category: professional.categories[0]!,
      titleAr,
      descAr: `بعد التعامل السابق مع ${professional.businessName}، أحتاج تدخلاً جديداً من نفس النوع في المنزل. الحالة جيدة عموماً وأريد نفس الجودة التي حصلت عليها في المرة الأولى.`,
      city: customer.city,
      neighborhood: neighborhoodFor(customer.city) ?? undefined,
      budgetMin: null as number | null,
      budgetMax: null as number | null,
      urgency: "NORMAL" as const,
      daysAgo: rev.daysAgo + 6,
      offers: [rev.professional],
      accepted: 0,
      bookingStatus: "COMPLETED" as const,
      review: undefined as undefined,
    };
  });

  const ALL_REQUESTS = [...REQUESTS, ...followUpRequests];
  const followUpOffset = REQUESTS.length;

  log("Creating requests", `${ALL_REQUESTS.length}`);
  const requests = ALL_REQUESTS.map((r, index) => {
    const created = daysAgo(r.daysAgo, 9);
    const bookingStatus: string | undefined = r.bookingStatus;
    // Declared as RequestStatus up front: a nested ternary of string literals
    // would otherwise be inferred per branch and lose CANCELLED/EXPIRED, which
    // later comparisons legitimately need.
    let status: RequestStatus = r.offers.length > 0 ? "RECEIVING_OFFERS" : "OPEN";
    if (bookingStatus === "COMPLETED") status = "COMPLETED";
    else if (bookingStatus === "CANCELLED") status = "CANCELLED";
    else if (bookingStatus === "IN_PROGRESS") status = "IN_PROGRESS";
    else if (bookingStatus) status = "OFFER_SELECTED";
    return {
      id: randomUUID(),
      reference: reference("REQ", index + 1),
      customerId: customers[r.customer]!.id,
      categoryId: categoryId.get(r.category)!,
      serviceId: null,
      title: r.titleAr,
      description: r.descAr,
      city: r.city,
      neighborhood: r.neighborhood ?? neighborhoodFor(r.city),
      address: r.neighborhood ?? neighborhoodFor(r.city),
      budgetMin: r.budgetMin,
      budgetMax: r.budgetMax,
      currency: "MAD",
      preferredDate: daysAhead(intBetween(2, 21)),
      preferredTime: pick(["08:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00", "flexible"]),
      urgency: r.urgency,
      status,
      maxOffers: 10,
      offersCount: r.offers.length,
      viewsCount: intBetween(10, 600),
      expiresAt: daysAhead(14 - Math.min(13, r.daysAgo)),
      closedAt: status === "COMPLETED" || status === "CANCELLED" ? daysAgo(Math.max(0, r.daysAgo - 5)) : null,
      createdAt: created,
    };
  });
  await prisma.serviceRequest.createMany({ data: requests });

  // ── Offers ────────────────────────────────────────────────────────────────
  let offerCounter = 0;
  const offers: {
    id: string;
    reference: string;
    requestId: string;
    professionalId: string;
    professionalProfileId: string;
    serviceId: string | null;
    price: number;
    message: string;
    notes: string | null;
    durationMin: number | null;
    proposedDate: Date;
    proposedTime: string;
    status: OfferStatus;
    isValidUntil: Date;
    respondedAt: Date;
    createdAt: Date;
    accepted: boolean;
    requestIndex: number;
    offerIndex: number;
  }[] = [];

  ALL_REQUESTS.forEach((r, requestIndex) => {
    const request = requests[requestIndex]!;
    const requestCreated = request.createdAt;
    r.offers.forEach((professionalIndex, offerIndex) => {
      const profile = professionalProfiles[professionalIndex];
      if (!profile) return;
      // A professional cannot offer on their own request.
      if (profile.userId === request.customerId) return;
      const isAccepted = r.accepted === offerIndex;
      const created = new Date(requestCreated.getTime() + (offerIndex + 1) * intBetween(2, 30) * 3600_000);
      const basePrice = r.budgetMax ?? r.budgetMin ?? 500;
      const price = Math.max(
        50,
        Math.round((basePrice * (0.72 + offerIndex * 0.09 + rnd() * 0.12)) / 10) * 10
      );
      offerCounter += 1;
      offers.push({
        id: randomUUID(),
        reference: reference("OFR", offerCounter),
        requestId: request.id,
        professionalId: profile.userId,
        professionalProfileId: profile.id,
        serviceId: null,
        price,
        message: OFFER_MESSAGES[(offerCounter - 1) % OFFER_MESSAGES.length]!,
        notes: OFFER_NOTES[(offerCounter - 1) % OFFER_NOTES.length]!,
        durationMin: intBetween(45, 480),
        proposedDate: daysAhead(intBetween(1, 14)),
        proposedTime: pick(["08:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00"]),
        // Seeded demand is never EXPIRED, so a cancelled request is the only
        // case that voids its outstanding offers.
        status: isAccepted ? "ACCEPTED" : request.status === "CANCELLED" ? "EXPIRED" : "PENDING",
        isValidUntil: new Date(created.getTime() + 7 * 86400_000),
        respondedAt: created,
        createdAt: created,
        accepted: isAccepted,
        requestIndex,
        offerIndex,
      });
    });
  });
  // Extra competing quotes on still-open demand — realistic for a live board
  // and it lifts the offer table past the 60-offer seed minimum.
  const seenPairs = new Set(offers.map((o) => `${o.requestId}:${o.professionalId}`));
  requests.forEach((request, requestIndex) => {
    if (!["OPEN", "RECEIVING_OFFERS"].includes(request.status)) return;
    const seed = ALL_REQUESTS[requestIndex]!;
    const candidates = professionalProfiles
      .map((profile, professionalIndex) => ({ profile, professionalIndex }))
      .filter(
        ({ profile, professionalIndex }) =>
          PROFESSIONALS[professionalIndex]!.verification === "VERIFIED" &&
          profile.userId !== request.customerId &&
          PROFESSIONALS[professionalIndex]!.categories.includes(CATEGORIES.find((c) => c.slug === seed.category)?.slug ?? "") &&
          !seenPairs.has(`${request.id}:${profile.userId}`) &&
          request.offersCount < 8
      )
      .slice(0, 2);

    candidates.forEach(({ profile }, position) => {
      seenPairs.add(`${request.id}:${profile.userId}`);
      offerCounter += 1;
      const created = new Date(request.createdAt.getTime() + intBetween(6, 90) * 3600_000);
      const basePrice = seed.budgetMax ?? seed.budgetMin ?? 800;
      offers.push({
        id: randomUUID(),
        reference: reference("OFR", offerCounter),
        requestId: request.id,
        professionalId: profile.userId,
        professionalProfileId: profile.id,
        serviceId: null,
        price: Math.max(50, Math.round((basePrice * (0.7 + position * 0.11 + rnd() * 0.15)) / 10) * 10),
        message: OFFER_MESSAGES[(offerCounter - 1) % OFFER_MESSAGES.length]!,
        notes: OFFER_NOTES[(offerCounter - 1) % OFFER_NOTES.length]!,
        durationMin: intBetween(45, 480),
        proposedDate: daysAhead(intBetween(1, 14)),
        proposedTime: pick(["08:00-12:00", "12:00-15:00", "15:00-18:00", "18:00-21:00"]),
        status: "PENDING",
        isValidUntil: new Date(created.getTime() + 7 * 86400_000),
        respondedAt: created,
        createdAt: created,
        accepted: false,
        requestIndex,
        offerIndex: position,
      });
      request.offersCount += 1;
    });
  });

  log("Creating offers", `${offers.length}`);
  await prisma.offer.createMany({
    data: offers.map(({ accepted: _a, requestIndex: _r, offerIndex: _o, ...data }) => ({ ...data, viewedAt: data.createdAt })),
  });

  // ── Bookings ──────────────────────────────────────────────────────────────
  const bookings: {
    id: string;
    reference: string;
    customerId: string;
    professionalId: string;
    requestId: string;
    offerId: string;
    serviceId: string | null;
    title: string;
    status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    scheduledDate: Date;
    scheduledTime: string;
    city: string;
    neighborhood: string | null;
    address: string;
    price: number;
    durationMin: number | null;
    confirmedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    cancelledBy: "CUSTOMER" | "PROFESSIONAL" | null;
    cancellationReason: string | null;
    createdAt: Date;
  }[] = [];

  let bookingCounter = 0;
  offers
    .filter((o) => o.accepted && ALL_REQUESTS[o.requestIndex]!.bookingStatus && ALL_REQUESTS[o.requestIndex]!.bookingStatus !== "CANCELLED")
    .forEach((offer) => {
      const request = requests[offer.requestIndex]!;
      const seed = ALL_REQUESTS[offer.requestIndex]!;
      const status = seed.bookingStatus!;
      bookingCounter += 1;
      const scheduledDate =
        status === "COMPLETED" || status === "IN_PROGRESS"
          ? daysAgo(Math.max(1, seed.daysAgo - 6))
          : daysAhead(intBetween(2, 20));
      const confirmedAt =
        status === "PENDING" ? null : new Date(offer.createdAt.getTime() + intBetween(2, 24) * 3600_000);
      const startedAt =
        status === "IN_PROGRESS" || status === "COMPLETED"
          ? new Date(scheduledDate.getTime() + 9 * 3600_000)
          : null;
      const completedAt =
        status === "COMPLETED" ? new Date(scheduledDate.getTime() + 16 * 3600_000) : null;

      bookings.push({
        id: randomUUID(),
        reference: reference("BKG", bookingCounter),
        customerId: request.customerId,
        professionalId: offer.professionalId,
        requestId: request.id,
        offerId: offer.id,
        serviceId: offer.serviceId,
        title: request.title,
        status,
        scheduledDate,
        scheduledTime: offer.proposedTime,
        city: request.city,
        neighborhood: request.neighborhood,
        address: request.address ?? request.city,
        price: offer.price,
        durationMin: offer.durationMin,
        confirmedAt,
        startedAt,
        completedAt,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        createdAt: new Date(offer.createdAt.getTime() + 3600_000),
      });
    });

  // Two cancelled bookings so the cancellation path has data.
  offers
    .filter((o) => o.accepted && ALL_REQUESTS[o.requestIndex]!.bookingStatus === "CANCELLED")
    .forEach((offer) => {
      const request = requests[offer.requestIndex]!;
      bookingCounter += 1;
      const cancelledAt = new Date(offer.createdAt.getTime() + 3 * 86400_000);
      bookings.push({
        id: randomUUID(),
        reference: reference("BKG", bookingCounter),
        customerId: request.customerId,
        professionalId: offer.professionalId,
        requestId: request.id,
        offerId: offer.id,
        serviceId: offer.serviceId,
        title: request.title,
        status: "CANCELLED",
        scheduledDate: daysAgo(intBetween(3, 20)),
        scheduledTime: offer.proposedTime,
        city: request.city,
        neighborhood: request.neighborhood,
        address: request.address ?? request.city,
        price: offer.price,
        durationMin: offer.durationMin,
        confirmedAt: new Date(offer.createdAt.getTime() + 5 * 3600_000),
        startedAt: null,
        completedAt: null,
        cancelledAt,
        cancelledBy: bookingCounter % 2 === 0 ? "CUSTOMER" : "PROFESSIONAL",
        cancellationReason:
          bookingCounter % 2 === 0
            ? "تغيرت الظروف ولم أعد بحاجة إلى الخدمة في هذا التاريخ."
            : "طارئ عائلي منعني من الحضور، أعتذر عن الإزعاج.",
        createdAt: new Date(offer.createdAt.getTime() + 3600_000),
      });
    });

  // Every extra review already has its own follow-up request + completed
  // booking created above, so no synthetic bookings are needed here.

  log("Creating bookings", `${bookings.length}`);
  await prisma.booking.createMany({
    data: bookings.map((b) => ({
      ...b,
      currency: "MAD",
      paymentStatus: b.status === "COMPLETED" ? ("UNPAID" as const) : ("UNPAID" as const),
      paymentMethod: "CASH" as const,
    })),
  });
  void professionalProfiles;

  await prisma.bookingStatusHistory.createMany({
    data: bookings.flatMap((b) => {
      const rows: Prisma.BookingStatusHistoryCreateManyInput[] = [
        { id: randomUUID(), bookingId: b.id, from: null, to: "PENDING", changedBy: b.customerId, reason: "تم إنشاء الحجز بعد قبول العرض", createdAt: b.createdAt },
      ];
      if (b.confirmedAt) {
        rows.push({ id: randomUUID(), bookingId: b.id, from: "PENDING", to: "CONFIRMED", changedBy: b.professionalId, reason: null, createdAt: b.confirmedAt });
      }
      if (b.startedAt) {
        rows.push({ id: randomUUID(), bookingId: b.id, from: "CONFIRMED", to: "IN_PROGRESS", changedBy: b.professionalId, reason: null, createdAt: b.startedAt });
      }
      if (b.completedAt) {
        rows.push({ id: randomUUID(), bookingId: b.id, from: "IN_PROGRESS", to: "COMPLETED", changedBy: b.customerId, reason: "أكد العميل انتهاء الأشغال", createdAt: b.completedAt });
      }
      if (b.cancelledAt) {
        rows.push({
          id: randomUUID(),
          bookingId: b.id,
          from: b.confirmedAt ? "CONFIRMED" : "PENDING",
          to: "CANCELLED",
          changedBy: b.cancelledBy === "PROFESSIONAL" ? b.professionalId : b.customerId,
          reason: b.cancellationReason,
          createdAt: b.cancelledAt,
        });
      }
      return rows;
    }),
  });

  // Link accepted offers ↔ requests and bookings ↔ requests.
  for (const booking of bookings) {
    await prisma.serviceRequest.update({
      where: { id: booking.requestId },
      data: {
        selectedOfferId: booking.offerId,
        bookingId: booking.id,
        ...(booking.status === "COMPLETED"
          ? { status: "COMPLETED", closedAt: booking.completedAt }
          : booking.status === "CANCELLED"
            ? { status: "CANCELLED", closedAt: booking.cancelledAt, cancelledReason: booking.cancellationReason }
            : booking.status === "IN_PROGRESS"
              ? { status: "IN_PROGRESS" }
              : { status: "OFFER_SELECTED" }),
      },
    });
  }

  // ── Reviews ───────────────────────────────────────────────────────────────
  const reviews: {
    id: string;
    bookingId: string;
    authorId: string;
    professionalId: string;
    serviceId: string | null;
    rating: number;
    comment: string;
    reply: string | null;
    repliedAt: Date | null;
    status: "PUBLISHED" | "HIDDEN" | "UNDER_REVIEW";
    isEdited: boolean;
    editableUntil: Date;
    helpfulCount: number;
    createdAt: Date;
  }[] = [];

  ALL_REQUESTS.forEach((seed, index) => {
    if (!seed.review) return;
    const booking = bookings.find((b) => b.requestId === requests[index]!.id && b.status === "COMPLETED");
    if (!booking) return;
    const profile = professionalProfiles.find((p) => p.userId === booking.professionalId)!;
    const created = new Date(booking.completedAt!.getTime() + intBetween(2, 72) * 3600_000);
    reviews.push({
      id: randomUUID(),
      bookingId: booking.id,
      authorId: booking.customerId,
      professionalId: profile.id,
      serviceId: booking.serviceId,
      rating: seed.review.rating,
      comment: seed.review.commentAr,
      reply: seed.review.replyAr ?? null,
      repliedAt: seed.review.replyAr ? new Date(created.getTime() + 20 * 3600_000) : null,
      status: "PUBLISHED",
      isEdited: false,
      editableUntil: new Date(created.getTime() + 30 * 86400_000),
      helpfulCount: intBetween(0, 14),
      createdAt: created,
    });
  });

  EXTRA_REVIEWS.forEach((rev, index) => {
    // The follow-up request for this review was created at a known offset.
    const followUpRequest = requests[followUpOffset + index]!;
    const booking = bookings.find((b) => b.requestId === followUpRequest.id && b.status === "COMPLETED");
    if (!booking || reviews.some((r) => r.bookingId === booking.id)) return;
    const profile = professionalProfiles[rev.professional]!;
    const created = new Date(booking.completedAt!.getTime() + intBetween(4, 96) * 3600_000);
    reviews.push({
      id: randomUUID(),
      bookingId: booking.id,
      authorId: booking.customerId,
      professionalId: profile.id,
      serviceId: booking.serviceId,
      rating: rev.rating,
      comment: rev.commentAr,
      reply: rev.replyAr ?? null,
      repliedAt: rev.replyAr ? new Date(created.getTime() + 26 * 3600_000) : null,
      status: rev.rating <= 2 ? "UNDER_REVIEW" : "PUBLISHED",
      isEdited: rnd() < 0.1,
      editableUntil: new Date(created.getTime() + 30 * 86400_000),
      helpfulCount: intBetween(0, 22),
      createdAt: created,
    });
  });

  log("Creating reviews", `${reviews.length}`);
  await prisma.review.createMany({
    data: reviews.map((r) => ({
      ...r,
      subRatings: {
        punctuality: Math.min(5, Math.max(1, r.rating + (rnd() < 0.4 ? 1 : 0))),
        quality: r.rating,
        communication: Math.min(5, Math.max(1, r.rating + (rnd() < 0.3 ? 1 : 0))),
      } as Prisma.InputJsonValue,
    })),
  });

  // ── Conversations & messages ──────────────────────────────────────────────
  const conversations: {
    id: string;
    conversationKey: string;
    customerId: string;
    professionalId: string;
    requestId: string | null;
    bookingId: string | null;
    serviceId: string | null;
    subject: string | null;
    lastMessageAt: Date;
    lastMessagePreview: string;
    isActive: boolean;
    createdAt: Date;
  }[] = [];
  const messages: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    status: "SENT" | "DELIVERED" | "READ";
    readAt: Date | null;
    createdAt: Date;
  }[] = [];
  const participants: {
    id: string;
    conversationId: string;
    userId: string;
    role: "CUSTOMER" | "PROFESSIONAL";
    lastReadAt: Date | null;
    lastReadMessageId: string | null;
    isMuted: boolean;
    unreadCount: number;
    createdAt: Date;
  }[] = [];

  CONVERSATIONS.forEach((thread, index) => {
    const customer = customers[thread.customer]!;
    const professional = professionalUsers[thread.professional]!;
    const request = thread.requestIndex !== undefined ? requests[thread.requestIndex]! : null;
    const booking = request ? (bookings.find((b) => b.requestId === request.id) ?? null) : null;
    const id = randomUUID();
    const created = request ? new Date(request.createdAt.getTime() + 2 * 3600_000) : hoursAgo(intBetween(6, 400));
    const sorted = [customer.id, professional.id].sort();
    const contextPart = booking?.id ?? request?.id ?? undefined;
    const key = contextPart ? `u:${sorted[0]}:${sorted[1]}:${contextPart}` : `u:${sorted[0]}:${sorted[1]}:${index}`;

    const threadMessages = thread.messages.map((m) => ({
      id: randomUUID(),
      conversationId: id,
      senderId: m.from === "customer" ? customer.id : professional.id,
      body: m.bodyAr,
      createdAt: minutesAgo(m.minutesAgo),
    }));

    const last = threadMessages[threadMessages.length - 1]!;
    const lastFromOther = last.senderId !== customer.id;

    conversations.push({
      id,
      conversationKey: key,
      customerId: customer.id,
      professionalId: professional.id,
      requestId: request?.id ?? null,
      bookingId: booking?.id ?? null,
      serviceId: null,
      subject: thread.subject,
      lastMessageAt: last.createdAt,
      lastMessagePreview: last.body.slice(0, 120),
      isActive: true,
      createdAt: created,
    });

    threadMessages.forEach((m, messageIndex) => {
      const isLast = messageIndex === threadMessages.length - 1;
      messages.push({
        ...m,
        status: isLast ? (lastFromOther ? "SENT" : "READ") : "READ",
        readAt: isLast && lastFromOther ? null : new Date(m.createdAt.getTime() + intBetween(2, 90) * 60_000),
      });
    });

    participants.push(
      {
        id: randomUUID(),
        conversationId: id,
        userId: customer.id,
        role: "CUSTOMER",
        lastReadAt: lastFromOther ? null : last.createdAt,
        lastReadMessageId: lastFromOther ? null : last.id,
        isMuted: false,
        unreadCount: lastFromOther && index % 2 === 0 ? 1 : 0,
        createdAt: created,
      },
      {
        id: randomUUID(),
        conversationId: id,
        userId: professional.id,
        role: "PROFESSIONAL",
        lastReadAt: lastFromOther ? last.createdAt : null,
        lastReadMessageId: lastFromOther ? last.id : null,
        isMuted: false,
        unreadCount: !lastFromOther && index % 3 === 0 ? 1 : 0,
        createdAt: created,
      }
    );
  });

  // Pad the message volume past the 150-message minimum with realistic
  // scheduling chatter on the busiest threads.
  const CHATTER = [
    "واش نتلاقاو في نفس العنوان؟",
    "نعم، العنوان هو نفسه المكتوب في الطلب.",
    "غادي نتصل بيك قبل ما نوصل بنصف ساعة.",
    "مزيان، أنا متاح.",
    "واش خاصك شي حاجة أخرى نجي بيها؟",
    "لا شكراً، كل شيء موجود.",
    "شكراً على سرعة الرد.",
    "على الرحب والسعة.",
    "واش ممكن نبدل الموعد بيوم واحد؟",
    "نعم ممكن، قول لي الوقت اللي يناسبك.",
    "غادي نزيد 30 دقيقة على المدة المتوقعة.",
    "ماكاين مشكل، خد وقتك.",
    "صيفطت لك الصور على الواتساب.",
    "وصلوني، شكراً. غادي نبدأ الخدمة غدا.",
  ];
  for (let i = messages.length; i < 165; i += 1) {
    const conversation = conversations[i % conversations.length]!;
    const isCustomer = i % 2 === 0;
    const created = minutesAgo(intBetween(30, 4000));
    messages.push({
      id: randomUUID(),
      conversationId: conversation.id,
      senderId: isCustomer ? conversation.customerId : conversation.professionalId,
      body: CHATTER[i % CHATTER.length]!,
      status: "READ",
      readAt: new Date(created.getTime() + intBetween(1, 60) * 60_000),
      createdAt: created,
    });
  }

  // Two standalone threads (a pre-sales question and a repeat-customer check-in)
  // so the conversation list is not entirely request-driven.
  const standaloneThreads = [
    {
      customer: 6,
      professional: 4,
      subject: "سؤال قبل طلب خدمة",
      messages: [
        { from: "customer" as const, bodyAr: "سلام، واش كتتنقلو إلى وجدة إلا كان العمل كبير؟", minutesAgo: 3200 },
        { from: "professional" as const, bodyAr: "وعليكم السلام. نعم كنتنقلو، ولكن إلا كانت المسافة أكثر من 60 كيلومتر كنزيد مصاريف التنقل.", minutesAgo: 3180 },
        { from: "customer" as const, bodyAr: "مفهوم. غادي نصيفط لك التفاصيل ونشر طلب.", minutesAgo: 3170 },
      ],
    },
    {
      customer: 9,
      professional: 5,
      subject: "عقد تنظيف شهري",
      messages: [
        { from: "customer" as const, bodyAr: "صباح الخير، بغيت عقد تنظيف شهري لمكتب من 90 متر بتطوان.", minutesAgo: 1400 },
        { from: "professional" as const, bodyAr: "صباح النور. كنخدمو في الشمال كامل. زيارة واحدة في الأسبوع بـ 450 درهم في الشهر، المواد داخلين.", minutesAgo: 1380 },
        { from: "customer" as const, bodyAr: "مزيان. واش يمكن نبدأو الأسبوع الجاي؟", minutesAgo: 1370 },
        { from: "professional" as const, bodyAr: "نعم، نقدر نبدأ نهار الثلاثاء. غادي نصيفط لك العقد على البريد.", minutesAgo: 1360 },
      ],
    },
  ];

  standaloneThreads.forEach((thread, index) => {
    const customer = customers[thread.customer]!;
    const professional = professionalUsers[thread.professional]!;
    const id = randomUUID();
    const sorted = [customer.id, professional.id].sort();
    const key = `u:${sorted[0]}:${sorted[1]}:standalone-${index}`;
    const created = minutesAgo(thread.messages[0]!.minutesAgo + 10);

    const threadMessages = thread.messages.map((m) => ({
      id: randomUUID(),
      conversationId: id,
      senderId: m.from === "customer" ? customer.id : professional.id,
      body: m.bodyAr,
      createdAt: minutesAgo(m.minutesAgo),
    }));
    const last = threadMessages[threadMessages.length - 1]!;

    conversations.push({
      id,
      conversationKey: key,
      customerId: customer.id,
      professionalId: professional.id,
      requestId: null,
      bookingId: null,
      serviceId: null,
      subject: thread.subject,
      lastMessageAt: last.createdAt,
      lastMessagePreview: last.body.slice(0, 120),
      isActive: true,
      createdAt: created,
    });
    threadMessages.forEach((m, messageIndex) => {
      const isLast = messageIndex === threadMessages.length - 1;
      const fromOther = m.senderId !== customer.id;
      messages.push({
        ...m,
        status: isLast && fromOther ? "SENT" : "READ",
        readAt: isLast && fromOther ? null : new Date(m.createdAt.getTime() + intBetween(2, 60) * 60_000),
      });
    });
    participants.push(
      {
        id: randomUUID(),
        conversationId: id,
        userId: customer.id,
        role: "CUSTOMER",
        lastReadAt: null,
        lastReadMessageId: null,
        isMuted: false,
        unreadCount: 1,
        createdAt: created,
      },
      {
        id: randomUUID(),
        conversationId: id,
        userId: professional.id,
        role: "PROFESSIONAL",
        lastReadAt: last.createdAt,
        lastReadMessageId: last.id,
        isMuted: false,
        unreadCount: 0,
        createdAt: created,
      }
    );
  });

  log("Creating conversations", `${conversations.length}`);
  log("Creating messages", `${messages.length}`);
  await prisma.conversation.createMany({ data: conversations });
  await prisma.message.createMany({ data: messages });
  await prisma.conversationParticipant.createMany({ data: participants });

  // ── Favorites ─────────────────────────────────────────────────────────────
  log("Creating favorites", `${FAVORITE_PAIRS.length}`);
  await prisma.favorite.createMany({
    data: FAVORITE_PAIRS.flatMap(([customerIndex, professionalIndex]) => {
      const customer = customers[customerIndex]!;
      const profile = professionalProfiles[professionalIndex]!;
      const proServices = services.filter((s) => s.professionalId === profile.id);
      return [
        {
          id: randomUUID(),
          userId: customer.id,
          targetType: "PROFESSIONAL" as const,
          targetId: profile.id,
          createdAt: daysAgo(intBetween(1, 120)),
        },
        ...(proServices[0]
          ? [
              {
                id: randomUUID(),
                userId: customer.id,
                targetType: "SERVICE" as const,
                targetId: proServices[0].id,
                createdAt: daysAgo(intBetween(1, 120)),
              },
            ]
          : []),
      ];
    }),
    skipDuplicates: true,
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  const notifications: {
    id: string;
    userId: string;
    type: string;
    title: string;
    body: string | null;
    data: Prisma.InputJsonValue;
    linkTo: string | null;
    isRead: boolean;
    readAt: Date | null;
    channels: Prisma.InputJsonValue;
    createdAt: Date;
  }[] = [];

  // Real notifications derived from the transactions above.
  offers.forEach((offer) => {
    const request = requests[offer.requestIndex]!;
    notifications.push({
      id: randomUUID(),
      userId: request.customerId,
      type: "NEW_OFFER",
      title: "عرض جديد على طلبك",
      body: `${request.title} — ${offer.price} د.م.`,
      data: { requestId: request.id, offerId: offer.id, amount: offer.price },
      linkTo: `/dashboard/requests/${request.id}`,
      isRead: rnd() < 0.6,
      readAt: null,
      channels: { inApp: "sent", email: "skipped", push: "skipped" },
      createdAt: offer.createdAt,
    });
  });

  bookings.forEach((booking) => {
    notifications.push({
      id: randomUUID(),
      userId: booking.professionalId,
      type: booking.status === "COMPLETED" ? "BOOKING_COMPLETED" : "BOOKING_CREATED",
      title: booking.status === "COMPLETED" ? "اكتملت الخدمة" : "قبل العميل عرضك",
      body: `${booking.title} (${booking.reference}) — ${booking.price} د.م.`,
      data: { bookingId: booking.id, bookingReference: booking.reference, amount: booking.price },
      linkTo: `/professional/bookings/${booking.id}`,
      isRead: booking.status === "COMPLETED",
      readAt: null,
      channels: { inApp: "sent", email: "skipped", push: "skipped" },
      createdAt: booking.createdAt,
    });
    notifications.push({
      id: randomUUID(),
      userId: booking.customerId,
      type: booking.status === "CONFIRMED" || booking.status === "IN_PROGRESS" || booking.status === "COMPLETED" ? "BOOKING_CONFIRMED" : "BOOKING_CREATED",
      title: booking.status === "PENDING" ? "تم إنشاء حجزك" : "تم تأكيد الحجز",
      body: `${booking.title} (${booking.reference})`,
      data: { bookingId: booking.id, bookingReference: booking.reference },
      linkTo: `/dashboard/bookings/${booking.id}`,
      isRead: booking.status !== "PENDING",
      readAt: null,
      channels: { inApp: "sent", email: "skipped", push: "skipped" },
      createdAt: booking.createdAt,
    });
  });

  reviews.forEach((review) => {
    const profile = professionalProfiles.find((p) => p.id === review.professionalId)!;
    notifications.push({
      id: randomUUID(),
      userId: profile.userId,
      type: "REVIEW_RECEIVED",
      title: "تقييم جديد",
      body: `${review.rating}/5 — ${review.comment.slice(0, 80)}`,
      data: { reviewId: review.id },
      linkTo: "/professional/reviews",
      isRead: rnd() < 0.7,
      readAt: null,
      channels: { inApp: "sent", email: "queued", push: "skipped" },
      createdAt: review.createdAt,
    });
    if (review.reply) {
      notifications.push({
        id: randomUUID(),
        userId: review.authorId,
        type: "REVIEW_REPLY",
        title: "رد المعلم على تقييمك",
        body: review.reply.slice(0, 100),
        data: { reviewId: review.id },
        linkTo: "/dashboard/reviews",
        isRead: false,
        readAt: null,
        channels: { inApp: "sent", email: "skipped", push: "skipped" },
        createdAt: review.repliedAt ?? review.createdAt,
      });
    }
  });

  // A few lifecycle templates so every notification type exists in the table.
  NOTIFICATION_SEEDS.forEach((template, index) => {
    const user = index % 3 === 0 ? customers[index % customers.length]! : professionalUsers[index % professionalUsers.length]!;
    notifications.push({
      id: randomUUID(),
      userId: user.id,
      type: template.type,
      title: template.title,
      body: template.body.replace("{amount}", String(intBetween(200, 4000))),
      data: { seeded: true },
      linkTo: index % 2 === 0 ? "/dashboard" : "/professional",
      isRead: index % 4 === 0,
      readAt: null,
      channels: { inApp: "sent", email: index % 3 === 0 ? "queued" : "skipped", push: "skipped" },
      createdAt: hoursAgo(intBetween(1, 500)),
    });
  });

  log("Creating notifications", `${notifications.length}`);
  await prisma.notification.createMany({
    data: notifications.map((n) => ({ ...n, readAt: n.isRead ? n.createdAt : null })),
  });

  // ── Reports & audit trail ─────────────────────────────────────────────────
  log("Creating reports and audit entries");
  const reportSeeds = [
    {
      reporter: 4,
      targetType: "PROFESSIONAL" as const,
      subject: 19,
      reason: "FRAUD" as const,
      details: "طلب مني دفع تسبيق نقداً قبل المعاينة ثم لم يحضر في الموعد المتفق عليه.",
      status: "OPEN" as const,
      priority: 3,
    },
    {
      reporter: 6,
      targetType: "REVIEW" as const,
      subject: 17,
      reason: "INAPPROPRIATE" as const,
      details: "التقييم يحتوي على سب وقذف لا علاقة له بجودة العمل.",
      status: "INVESTIGATING" as const,
      priority: 2,
    },
    {
      reporter: 2,
      targetType: "SERVICE" as const,
      subject: 0,
      reason: "SPAM" as const,
      details: "نفس الخدمة منشورة ثلاث مرات بعناوين مختلفة لرفع الظهور في البحث.",
      status: "RESOLVED" as const,
      priority: 1,
    },
    {
      reporter: 8,
      targetType: "USER" as const,
      subject: 16,
      reason: "FAKE_PROFILE" as const,
      details: "الصور في الملف الشخصي مسروقة من موقع أجنبي.",
      status: "OPEN" as const,
      priority: 2,
    },
  ];
  await prisma.report.createMany({
    data: reportSeeds.map((report, index) => ({
      id: randomUUID(),
      reference: reference("RPT", index + 1),
      reporterId: customers[report.reporter]!.id,
      targetType: report.targetType,
      targetId:
        report.targetType === "SERVICE"
          ? services[index % services.length]!.id
          : report.targetType === "REVIEW"
            ? reviews[index % reviews.length]!.id
            : professionalUsers[report.subject]!.id,
      subjectUserId: professionalUsers[report.subject]!.id,
      reason: report.reason,
      details: report.details,
      evidence: [],
      status: report.status,
      priority: report.priority,
      assignedToId: report.status === "OPEN" ? null : admin.id,
      resolvedById: report.status === "RESOLVED" ? admin.id : null,
      resolvedAt: report.status === "RESOLVED" ? daysAgo(12) : null,
      resolution: report.status === "RESOLVED" ? "تم إخفاء الخدمة المكررة وتنبيه المهني." : null,
      actionTaken: report.status === "RESOLVED" ? "SERVICE_HIDDEN" : null,
      createdAt: daysAgo(20 - index * 3),
    })),
  });

  await prisma.auditLog.createMany({
    data: [
      ...bookings.slice(0, 12).map((booking) => ({
        id: randomUUID(),
        actorId: booking.customerId,
        action: "OFFER_ACCEPTED",
        targetType: "BOOKING",
        targetId: booking.id,
        metadata: { bookingReference: booking.reference, price: booking.price },
        createdAt: booking.createdAt,
      })),
      ...professionalProfiles
        .filter((p) => p.verificationStatus === "VERIFIED")
        .map((profile) => ({
          id: randomUUID(),
          actorId: admin.id,
          action: "PROFESSIONAL_VERIFIED",
          targetType: "PROFESSIONAL",
          targetId: profile.id,
          metadata: { method: "MANUAL" },
          createdAt: profile.verifiedAt ?? profile.createdAt,
        })),
      {
        id: randomUUID(),
        actorId: admin.id,
        action: "PROFESSIONAL_SUSPENDED",
        targetType: "PROFESSIONAL",
        targetId: professionalProfiles[19]!.id,
        metadata: { reason: "شكايات متكررة بخصوص عدم الحضور" },
        createdAt: daysAgo(9),
      },
      {
        id: randomUUID(),
        actorId: admin.id,
        action: "REPORT_RESOLVED",
        targetType: "REPORT",
        targetId: null,
        metadata: { reference: reference("RPT", 3) },
        createdAt: daysAgo(12),
      },
    ],
  });

  // ── Demo sessions so the accounts look recently active ────────────────────
  await prisma.session.createMany({
    data: [admin, customers[0]!, professionalUsers[0]!].map((user) => ({
      id: randomUUID(),
      userId: user.id,
      tokenHash: randomUUID().replace(/-/g, ""),
      ipAddress: "41.140.12.7",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      expiresAt: daysAhead(30),
      createdAt: hoursAgo(6),
    })),
  });

  // ── Recompute every denormalised counter from source rows ─────────────────
  log("Recomputing counters and aggregates");

  // One grouped query per aggregate — the seed must not issue hundreds of
  // per-row counts, and the numbers have to come from the persisted rows.
  const ratingRows = await prisma.$queryRaw<{ professional_id: string; avg: number; cnt: bigint }[]>`
    SELECT professional_id, AVG(rating)::float AS avg, COUNT(*)::bigint AS cnt
    FROM reviews WHERE status <> 'HIDDEN' GROUP BY professional_id`;
  const ratingByProfile = new Map(ratingRows.map((r) => [r.professional_id, { avg: r.avg, count: Number(r.cnt) }]));

  const completedRows = await prisma.booking.groupBy({
    by: ["professionalId", "status"],
    _count: { _all: true },
  });
  const offerRows = await prisma.offer.groupBy({
    by: ["professionalId"],
    _count: { _all: true },
  });
  const respondedRows = await prisma.offer.groupBy({
    by: ["professionalId"],
    where: { respondedAt: { not: null } },
    _count: { _all: true },
  });
  const completedBy = (userId: string, status: string) =>
    completedRows.filter((r) => r.professionalId === userId && r.status === status).reduce((a, r) => a + r._count._all, 0);
  const offersBy = new Map(offerRows.map((r) => [r.professionalId, r._count._all]));
  const respondedBy = new Map(respondedRows.map((r) => [r.professionalId, r._count._all]));

  for (const profile of professionalProfiles) {
    const rating = ratingByProfile.get(profile.id);
    const total = offersBy.get(profile.userId) ?? 0;
    const responded = respondedBy.get(profile.userId) ?? 0;
    await prisma.professionalProfile.update({
      where: { id: profile.id },
      data: {
        ratingAverage: Math.round((rating?.avg ?? 0) * 100) / 100,
        ratingCount: rating?.count ?? 0,
        completedJobs: completedBy(profile.userId, "COMPLETED"),
        cancelledJobs: completedBy(profile.userId, "CANCELLED"),
        responseRate: total === 0 ? 100 : Math.round((responded / total) * 100),
      },
    });
  }

  // Service ratings.
  const serviceRatingRows = await prisma.$queryRaw<{ service_id: string; avg: number; cnt: bigint }[]>`
    SELECT service_id, AVG(rating)::float AS avg, COUNT(*)::bigint AS cnt
    FROM reviews WHERE status <> 'HIDDEN' AND service_id IS NOT NULL GROUP BY service_id`;
  for (const row of serviceRatingRows) {
    await prisma.service.update({
      where: { id: row.service_id },
      data: { ratingAverage: Math.round(row.avg * 100) / 100, ratingCount: Number(row.cnt) },
    });
  }

  // Request offer counters.
  const requestOfferRows = await prisma.offer.groupBy({
    by: ["requestId"],
    where: { status: { not: "WITHDRAWN" } },
    _count: { _all: true },
  });
  for (const row of requestOfferRows) {
    await prisma.serviceRequest.update({ where: { id: row.requestId }, data: { offersCount: row._count._all } });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const [userCount, proCount, serviceCount, requestCount, offerCount, bookingCount, reviewCount, conversationCount, messageCount, notificationCount, favoriteCount, reportCount, auditCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.professionalProfile.count(),
      prisma.service.count(),
      prisma.serviceRequest.count(),
      prisma.offer.count(),
      prisma.booking.count(),
      prisma.review.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      prisma.notification.count(),
      prisma.favorite.count(),
      prisma.report.count(),
      prisma.auditLog.count(),
    ]);

  console.log(`
\x1b[32m✓ Seed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s\x1b[0m

  users            ${String(userCount).padStart(5)}   (1 admin · ${CUSTOMERS.length} customers · ${PROFESSIONALS.length} professionals)
  professionals    ${String(proCount).padStart(5)}   (${professionalProfiles.filter((p) => p.verificationStatus === "VERIFIED").length} verified · ${professionalProfiles.filter((p) => p.verificationStatus === "PENDING").length} pending · ${professionalProfiles.filter((p) => p.verificationStatus === "REJECTED").length} rejected · ${professionalProfiles.filter((p) => p.verificationStatus === "SUSPENDED").length} suspended)
  categories       ${String(CATEGORIES.length).padStart(5)}
  services         ${String(serviceCount).padStart(5)}   (${services.filter((s) => s.status === "PUBLISHED").length} published)
  requests         ${String(requestCount).padStart(5)}
  offers           ${String(offerCount).padStart(5)}
  bookings         ${String(bookingCount).padStart(5)}   (${bookings.filter((b) => b.status === "COMPLETED").length} completed)
  reviews          ${String(reviewCount).padStart(5)}
  conversations    ${String(conversationCount).padStart(5)}
  messages         ${String(messageCount).padStart(5)}
  notifications    ${String(notificationCount).padStart(5)}
  favorites        ${String(favoriteCount).padStart(5)}
  reports          ${String(reportCount).padStart(5)}
  audit logs       ${String(auditCount).padStart(5)}

  \x1b[1mDemo accounts\x1b[0m — password: \x1b[33m${SEED_PASSWORD}\x1b[0m
    ${ADMIN_EMAIL.padEnd(26)} → /admin
    ${CUSTOMERS[0]!.email.padEnd(26)} → /dashboard
    ${PROFESSIONALS[0]!.email.padEnd(26)} → /professional
`);
}

main()
  .catch((error) => {
    console.error("\n\x1b[31m✗ Seed failed\x1b[0m");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
