import type { Prisma, Role, UserStatus, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { notFound, forbidden, unprocessable, conflict } from "@/lib/api/errors";
import { paginationMeta, type PaginationInput, sanitizedTextSchema, citySchema } from "@/lib/validation/common";
import { revokeAllUserSessions } from "@/lib/auth/session";
import { createNotifications } from "@/server/notifications/service";
import { normalizeMoroccanPhone } from "@/lib/utils";
import { ensureUniqueSlug, slugify } from "@/lib/utils/slug";

/**
 * Accounts, profiles and admin moderation (§24).
 *
 * Every moderation action:
 *   1. runs inside a transaction with the audit-log write,
 *   2. revokes live sessions when it restricts access,
 *   3. notifies the affected user in-app.
 */

// ─── Validation ──────────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  firstName: sanitizedTextSchema.pipe(z.string().trim().min(2).max(60)).optional(),
  lastName: sanitizedTextSchema.pipe(z.string().trim().min(1).max(60)).optional(),
  avatarUrl: z.string().trim().max(2048).nullable().optional(),
  city: citySchema.nullable().optional(),
  address: sanitizedTextSchema.pipe(z.string().trim().max(300)).nullable().optional(),
  bio: sanitizedTextSchema.pipe(z.string().trim().max(1000)).nullable().optional(),
  phone: z.string().trim().min(9).max(20).optional(),
  locale: z.enum(["AR", "FR", "EN"]).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const notificationPreferencesSchema = z.object({
  notifyByEmail: z.coerce.boolean().optional(),
  notifyByPhone: z.coerce.boolean().optional(),
  notifyByWhatsapp: z.coerce.boolean().optional(),
});

// ─── Reads ───────────────────────────────────────────────────────────────────

const USER_ADMIN_INCLUDE = {
  identity: { select: { fullName: true, firstName: true, lastName: true, avatarUrl: true, city: true } },
  professionalProfile: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      city: true,
      verificationStatus: true,
      ratingAverage: true,
      ratingCount: true,
      completedJobs: true,
      isFeatured: true,
      availabilityStatus: true,
      createdAt: true,
    },
  },
  _count: {
    select: {
      services: true,
      serviceRequests: true,
      offersMade: true,
      bookingsAsCustomer: true,
      bookingsAsPro: true,
      reviewsWritten: true,
      reportsFiled: true,
      reportsAbout: true,
    },
  },
} as const satisfies Prisma.UserInclude;

export type AdminUserRow = Prisma.UserGetPayload<{ include: typeof USER_ADMIN_INCLUDE }>;

export interface ListUsersInput extends Partial<PaginationInput> {
  role?: Role;
  status?: UserStatus;
  verification?: VerificationStatus;
  search?: string;
  city?: string;
  sort?: "newest" | "oldest" | "rating" | "name" | "activity";
}

export async function listUsers(input: ListUsersInput = {}) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 15));

  // City and search each need an `OR`; spreading both into one object literal
  // would drop the city clause, so they compose via `AND` (same rule as the
  // services/professionals where-builders).
  const orClauses: Prisma.UserWhereInput[] = [];
  if (input.city) {
    orClauses.push({
      OR: [
        { identity: { city: input.city } },
        { professionalProfile: { city: input.city } },
        { customerProfile: { defaultCity: input.city } },
      ],
    });
  }
  if (input.search) {
    orClauses.push({
      OR: [
        { email: { contains: input.search, mode: "insensitive" } },
        { phone: { contains: input.search.replace(/\s/g, "") } },
        { identity: { fullName: { contains: input.search, mode: "insensitive" } } },
        { professionalProfile: { businessName: { contains: input.search, mode: "insensitive" } } },
        { professionalProfile: { slug: { contains: input.search, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(input.role ? { role: input.role } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.verification ? { professionalProfile: { verificationStatus: input.verification } } : {}),
    ...(orClauses.length === 1
      ? orClauses[0]
      : orClauses.length > 1
        ? { AND: orClauses }
        : {}),
  };

  const orderBy: Prisma.UserOrderByWithRelationInput[] =
    input.sort === "oldest"
      ? [{ createdAt: "asc" }]
      : input.sort === "name"
        ? [{ identity: { fullName: "asc" } }]
        : input.sort === "rating"
          ? [{ professionalProfile: { ratingAverage: "desc" } }]
          : input.sort === "activity"
            ? [{ lastLoginAt: "desc" }]
            : [{ createdAt: "desc" }];

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      include: USER_ADMIN_INCLUDE,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, ...paginationMeta(page, perPage, total) };
}

export async function getUserForAdmin(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      ...USER_ADMIN_INCLUDE,
      customerProfile: true,
      documents: { orderBy: { createdAt: "desc" } },
      sessions: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, createdAt: true, ipAddress: true, revokedAt: true, expiresAt: true } },
    },
  });
  if (!user) throw notFound("User not found.");
  return user;
}

export async function getOwnAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      locale: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      lastLoginAt: true,
      identity: true,
      customerProfile: true,
      professionalProfile: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          headline: true,
          about: true,
          avatarUrl: true,
          coverUrl: true,
          city: true,
          neighborhood: true,
          serviceRadiusKm: true,
          yearsExperience: true,
          languages: true,
          website: true,
          phonePublic: true,
          publicPhone: true,
          verificationStatus: true,
          availabilityStatus: true,
          availability: true,
          acceptsUrgentJobs: true,
          ratingAverage: true,
          ratingCount: true,
          completedJobs: true,
          responseRate: true,
          responseTimeMin: true,
          isFeatured: true,
          profileViews: true,
        },
      },
      _count: { select: { notifications: { where: { isRead: false } } } },
    },
  });
  if (!user) throw notFound("Account not found.");
  return user;
}

// ─── Self-service writes ─────────────────────────────────────────────────────

export async function updateOwnProfile(userId: string, input: UpdateProfileInput) {
  const identityUpdate: Prisma.ProfileUpdateInput = {};
  if (input.firstName !== undefined) identityUpdate.firstName = input.firstName;
  if (input.lastName !== undefined) identityUpdate.lastName = input.lastName;
  if (input.avatarUrl !== undefined) identityUpdate.avatarUrl = input.avatarUrl;
  if (input.city !== undefined) identityUpdate.city = input.city;
  if (input.address !== undefined) identityUpdate.address = input.address;
  if (input.bio !== undefined) identityUpdate.bio = input.bio;
  if (input.firstName !== undefined || input.lastName !== undefined) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { identity: { select: { firstName: true, lastName: true } } },
    });
    const first = input.firstName ?? current?.identity?.firstName ?? "";
    const last = input.lastName ?? current?.identity?.lastName ?? "";
    identityUpdate.fullName = `${first} ${last}`.trim();
  }

  const userUpdate: Prisma.UserUpdateInput = {};
  if (input.locale !== undefined) userUpdate.locale = input.locale;
  if (input.phone !== undefined) {
    const normalized = normalizeMoroccanPhone(input.phone);
    if (!normalized) throw unprocessable("Please provide a valid Moroccan phone number.");
    const clash = await prisma.user.findFirst({ where: { phone: normalized, id: { not: userId } }, select: { id: true } });
    if (clash) throw conflict("This phone number is already used by another account.", { field: "phone" });
    userUpdate.phone = normalized;
  }

  const [user] = await prisma.$transaction([
    ...(Object.keys(userUpdate).length ? [prisma.user.update({ where: { id: userId }, data: userUpdate })] : []),
    ...(Object.keys(identityUpdate).length
      ? [prisma.profile.update({ where: { userId }, data: identityUpdate })]
      : []),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, phone: true, locale: true } }),
  ]);

  return user;
}

export async function updateNotificationPreferences(userId: string, input: z.infer<typeof notificationPreferencesSchema>) {
  const existing = await prisma.customerProfile.findUnique({ where: { userId }, select: { id: true } });
  const data: Prisma.CustomerProfileUpdateInput = {};
  if (input.notifyByEmail !== undefined) data.notifyByEmail = input.notifyByEmail;
  if (input.notifyByPhone !== undefined) data.notifyByPhone = input.notifyByPhone;
  if (input.notifyByWhatsapp !== undefined) data.notifyByWhatsapp = input.notifyByWhatsapp;

  if (existing) return prisma.customerProfile.update({ where: { id: existing.id }, data });
  return prisma.customerProfile.create({ data: { userId, ...data } as Prisma.CustomerProfileCreateInput });
}

/** Self-service deactivation: hides the account but preserves history. */
export async function deactivateOwnAccount(userId: string) {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "DEACTIVATED", deletedAt: new Date() } }),
    prisma.professionalProfile.updateMany({ where: { userId }, data: { availabilityStatus: "UNAVAILABLE" } }),
    prisma.service.updateMany({ where: { ownerUserId: userId, status: "PUBLISHED" }, data: { status: "PAUSED" } }),
    prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "ACCOUNT_SELF_DEACTIVATED",
        targetType: "USER",
        targetId: userId,
        targetUserId: userId,
      },
    }),
  ]);
  return { deactivated: true };
}

// ─── Admin moderation ────────────────────────────────────────────────────────

export interface ModerationInput {
  reason?: string | null;
}

/**
 * Writes an audit entry. `targetId` holds the id of whatever row was acted on
 * (a professional profile, a service, a report…), while `targetUserId` is set
 * when the action concerned an account so it can be joined back to `users`.
 */
async function writeAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>,
  targetUserId?: string
) {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      targetUserId: targetUserId ?? (targetType === "USER" ? targetId : null),
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function setUserStatus(adminId: string, userId: string, status: UserStatus, input: ModerationInput = {}) {
  if (adminId === userId) throw unprocessable("You cannot moderate your own account.");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true, email: true } });
  if (!target) throw notFound("User not found.");
  if (target.role === "ADMIN" && status === "SUSPENDED") {
    // Guard against locking the platform out of its own admin pool.
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (adminCount <= 1) throw unprocessable("The last active administrator cannot be suspended.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED" || status === "DEACTIVATED") {
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.professionalProfile.updateMany({ where: { userId }, data: { availabilityStatus: "UNAVAILABLE" } });
      await tx.service.updateMany({ where: { ownerUserId: userId, status: "PUBLISHED" }, data: { status: "HIDDEN" } });
    }
    if (status === "ACTIVE") {
      await tx.professionalProfile.updateMany({ where: { userId }, data: { availabilityStatus: "AVAILABLE" } });
    }
    await writeAudit(tx, adminId, `USER_${status}`, "USER", userId, { from: target.status, reason: input.reason ?? null }, userId);
    await tx.notification.create({
      data: {
        userId,
        type: status === "SUSPENDED" ? "ACCOUNT_SUSPENDED" : "SYSTEM",
        title:
          status === "SUSPENDED"
            ? "تم تعليق حسابك"
            : status === "ACTIVE"
              ? "تمت إعادة تفعيل حسابك"
              : "تحديث حالة الحساب",
        body: input.reason ?? null,
        data: { status },
        linkTo: status === "ACTIVE" ? "/" : "/login",
        channels: { inApp: "sent", email: "queued", push: "skipped" },
      },
    });
  });

  // Force logout happens even if the notification write above failed.
  if (status === "SUSPENDED" || status === "DEACTIVATED") {
    await revokeAllUserSessions(userId).catch(() => undefined);
  }

  return prisma.user.findUnique({ where: { id: userId }, include: USER_ADMIN_INCLUDE });
}

export async function setProfessionalVerification(
  adminId: string,
  professionalProfileId: string,
  verificationStatus: VerificationStatus,
  input: ModerationInput & { method?: "MANUAL" | "PHONE" | "EMAIL" } = {}
) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: professionalProfileId },
    select: { id: true, userId: true, verificationStatus: true, slug: true, businessName: true },
  });
  if (!profile) throw notFound("Professional profile not found.");

  await prisma.$transaction(async (tx) => {
    await tx.professionalProfile.update({
      where: { id: professionalProfileId },
      data: {
        verificationStatus,
        verifiedAt: verificationStatus === "VERIFIED" ? new Date() : null,
        verifiedBy: verificationStatus === "VERIFIED" ? adminId : null,
        verificationMethod: verificationStatus === "VERIFIED" ? (input.method ?? "MANUAL") : null,
        verificationNote: input.reason ?? null,
      },
    });
    if (verificationStatus === "SUSPENDED" || verificationStatus === "REJECTED") {
      await tx.user.update({ where: { id: profile.userId }, data: { status: verificationStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" } });
      await tx.service.updateMany({
        where: { professionalId: professionalProfileId, status: "PUBLISHED" },
        data: { status: verificationStatus === "SUSPENDED" ? "HIDDEN" : "PAUSED" },
      });
      if (verificationStatus === "SUSPENDED") {
        await tx.session.updateMany({ where: { userId: profile.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
    }
    await writeAudit(
      tx,
      adminId,
      `PROFESSIONAL_${verificationStatus}`,
      "PROFESSIONAL",
      professionalProfileId,
      { from: profile.verificationStatus, reason: input.reason ?? null },
      profile.userId
    );
    await tx.notification.create({
      data: {
        userId: profile.userId,
        type: verificationStatus === "VERIFIED" ? "ACCOUNT_VERIFIED" : verificationStatus === "SUSPENDED" ? "ACCOUNT_SUSPENDED" : "SYSTEM",
        title:
          verificationStatus === "VERIFIED"
            ? "✓ تم توثيق حسابك"
            : verificationStatus === "REJECTED"
              ? "تم رفض التوثيق"
              : verificationStatus === "SUSPENDED"
                ? "تم تعليق حسابك"
                : "تحديث حالة التوثيق",
        body: input.reason ?? null,
        data: { verificationStatus },
        linkTo: "/professional/profile",
        channels: { inApp: "sent", email: "queued", push: "skipped" },
      },
    });
  });

  if (verificationStatus === "SUSPENDED") await revokeAllUserSessions(profile.userId).catch(() => undefined);

  return prisma.professionalProfile.findUnique({
    where: { id: professionalProfileId },
    select: { id: true, verificationStatus: true, verifiedAt: true, verificationNote: true },
  });
}

export async function setProfessionalFeatured(adminId: string, professionalProfileId: string, isFeatured: boolean) {
  const [profile] = await prisma.$transaction([
    prisma.professionalProfile.update({ where: { id: professionalProfileId }, data: { isFeatured } }),
    prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: isFeatured ? "PROFESSIONAL_FEATURED" : "PROFESSIONAL_UNFEATURED",
        targetType: "PROFESSIONAL",
        targetId: professionalProfileId,
      },
    }),
  ]);
  return profile;
}

/** Promotes a customer account to professional, creating the profile row. */
export async function promoteToProfessional(adminId: string, userId: string, city = "casablanca") {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, identity: { select: { fullName: true, city: true } } },
  });
  if (!user) throw notFound("User not found.");
  if (user.role === "PROFESSIONAL") throw conflict("This account is already a professional.");
  if (user.role === "ADMIN") throw unprocessable("Administrator accounts cannot become professionals.");

  const fullName = user.identity?.fullName ?? "maalem";
  const slug = await ensureUniqueSlug(slugify(fullName, "maalem"), async (candidate) =>
    Boolean(await prisma.professionalProfile.findUnique({ where: { slug: candidate }, select: { id: true } }))
  );

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: "PROFESSIONAL" } });
    const profile = await tx.professionalProfile.create({
      data: {
        userId,
        slug,
        city: user.identity?.city ?? city,
        verificationStatus: "PENDING",
        availabilityStatus: "AVAILABLE",
      },
    });
    await tx.serviceArea.create({
      data: { professionalId: profile.id, city: profile.city, radiusKm: 20, isPrimary: true },
    });
    await writeAudit(tx, adminId, "USER_PROMOTED_PROFESSIONAL", "USER", userId, { professionalId: profile.id }, userId);
    return profile;
  });
}

export async function listAuditLogs(input: Partial<PaginationInput> & { action?: string; targetType?: string; targetId?: string } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 25));
  const where: Prisma.AuditLogWhereInput = {
    ...(input.action ? { action: input.action } : {}),
    ...(input.targetType ? { targetType: input.targetType } : {}),
    ...(input.targetId ? { targetId: input.targetId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { actor: { select: { id: true, email: true, identity: { select: { fullName: true } } } } },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, ...paginationMeta(page, perPage, total) };
}

export { forbidden };
