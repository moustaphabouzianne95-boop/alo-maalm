import type { Locale, Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword, isPasswordAcceptable } from "@/lib/auth/password";
import { generateOpaqueToken, hashToken } from "@/lib/auth/token";
import { createSession, destroySession, revokeAllUserSessions } from "@/lib/auth/session";
import { ApiError, ErrorCode, conflict, forbidden, notFound, unprocessable, unauthenticated } from "@/lib/api/errors";
import { normalizeMoroccanPhone } from "@/lib/utils";
import { ensureUniqueSlug, slugify } from "@/lib/utils/slug";
import { sendMail } from "@/lib/notifications/mailer";
import { env, isDevelopment } from "@/lib/env";
import { absoluteUrl } from "@/lib/utils";

/**
 * Authentication service — the only place credentials are created or checked.
 *
 * Rules enforced here (never trusted from the client):
 *   • email + phone uniqueness (DB constraints *and* a friendly pre-check)
 *   • bcrypt password hashing
 *   • `ADMIN` can never be self-selected at registration
 *   • suspended/deactivated accounts cannot sign in
 *   • login failures return one identical message (no user enumeration)
 *   • password reset invalidates every existing session
 */

export type RegisterRole = Role;

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  role: Exclude<Role, "ADMIN"> | "ADMIN";
  city?: string | null;
  locale?: Locale;
  businessName?: string | null;
  headline?: string | null;
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    phone: string;
    role: Role;
    name: string;
    city: string | null;
    professionalSlug?: string | null;
    requiresEmailVerification: boolean;
  };
}

const GENERIC_LOGIN_FAILURE = "Incorrect email or password.";

function splitName(fullName?: string, firstName?: string, lastName?: string) {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (first || last) return { firstName: first, lastName: last };
  const parts = (fullName ?? "").trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const phone = normalizeMoroccanPhone(input.phone);
  if (!phone) throw unprocessable("Please provide a valid Moroccan phone number (e.g. 0612345678).");
  if (!isPasswordAcceptable(input.password)) {
    throw unprocessable(`Password must be at least 8 characters.`);
  }
  // Defence in depth: an `ADMIN` value reaching this function is a bug or an
  // attack — never a legitimate registration.
  if (input.role === "ADMIN") {
    throw forbidden("Administrator accounts cannot be created through registration.");
  }

  const { firstName, lastName } = splitName(undefined, input.firstName, input.lastName);
  if (!firstName) throw unprocessable("Full name is required.");

  const [existingEmail, existingPhone] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.user.findUnique({ where: { phone }, select: { id: true } }),
  ]);
  if (existingEmail) throw conflict("An account with this email already exists.", { field: "email" });
  if (existingPhone) throw conflict("An account with this phone number already exists.", { field: "phone" });

  const passwordHash = await hashPassword(input.password);
  const fullName = `${firstName} ${lastName}`.trim();
  const userId = crypto.randomUUID();

  const verification = await generateOpaqueToken();
  const city = input.city ? slugify(input.city) || input.city : null;

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email,
        phone,
        passwordHash,
        role: input.role,
        status: "ACTIVE",
        locale: input.locale ?? "AR",
        identity: {
          create: {
            firstName,
            lastName: lastName || firstName,
            fullName: fullName || firstName,
            city,
          },
        },
        ...(input.role === "CUSTOMER"
          ? { customerProfile: { create: { defaultCity: city } } }
          : {}),
      },
    });

    if (input.role === "PROFESSIONAL") {
      // Verification starts PENDING; an admin promotes it to VERIFIED.
      const slug = await ensureUniqueSlug(
        slugify(input.businessName || fullName, "maalem"),
        async (candidate) => Boolean(await tx.professionalProfile.findUnique({ where: { slug: candidate }, select: { id: true } }))
      );
      await tx.professionalProfile.create({
        data: {
          userId,
          slug,
          businessName: input.businessName?.trim() || null,
          headline: input.headline?.trim() || null,
          city: city ?? "casablanca",
          verificationStatus: "PENDING",
          availabilityStatus: "AVAILABLE",
          yearsExperience: 0,
          serviceRadiusKm: 20,
        },
      });
      await tx.serviceArea.create({
        data: { professionalId: (await tx.professionalProfile.findUnique({ where: { slug }, select: { id: true } }))!.id, city: city ?? "casablanca", radiusKm: 20, isPrimary: true },
      });
    }

    await tx.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: verification.tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 h
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: "USER_REGISTERED",
        targetType: "USER",
        targetId: userId,
        metadata: { role: input.role, city },
        ipAddress: input.ip ?? null,
      },
    });
  });

  await sendMail({
    to: email,
    subject: "Confirm your email — ألو المعلم",
    text:
      `Welcome to ألو المعلم!\n\n` +
      `Confirm your email address to activate notifications:\n` +
      `${absoluteUrl(`/verify-email?token=${verification.token}`)}\n\n` +
      `This link expires in 24 hours.`,
    template: "verify-email",
    data: { firstName, verificationUrl: absoluteUrl(`/verify-email?token=${verification.token}`) },
  });

  const professional =
    input.role === "PROFESSIONAL"
      ? await prisma.professionalProfile.findUnique({ where: { userId }, select: { slug: true } })
      : null;

  return {
    user: {
      id: userId,
      email,
      phone,
      role: input.role,
      name: fullName || email,
      city,
      professionalSlug: professional?.slug ?? null,
      requiresEmailVerification: true,
    },
  };
}

export interface LoginInput {
  identifier: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export async function loginUser(input: LoginInput) {
  const identifier = input.identifier.trim();
  if (!identifier || !input.password) {
    throw new ApiError(ErrorCode.BAD_REQUEST, GENERIC_LOGIN_FAILURE);
  }

  const asPhone = normalizeMoroccanPhone(identifier);
  const user = await prisma.user.findFirst({
    where: asPhone
      ? { OR: [{ email: identifier.toLowerCase() }, { phone: asPhone }] }
      : { email: identifier.toLowerCase() },
    include: { professionalProfile: { select: { slug: true } }, identity: { select: { fullName: true } } },
  });

  // Always run a hash comparison, even for unknown accounts, so response time
  // does not reveal whether an email exists.
  const passwordOk = user ? await verifyPassword(input.password, user.passwordHash) : await verifyPassword(input.password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !passwordOk) {
    throw unauthenticated(GENERIC_LOGIN_FAILURE);
  }
  if (user.deletedAt) throw unauthenticated(GENERIC_LOGIN_FAILURE);
  if (user.status === "SUSPENDED") {
    throw new ApiError(ErrorCode.LOCKED, "This account has been suspended. Contact support for details.", { status: 423 });
  }
  if (user.status === "DEACTIVATED") {
    throw new ApiError(ErrorCode.LOCKED, "This account has been deactivated.", { status: 423 });
  }
  if (user.status === "PENDING") {
    throw new ApiError(ErrorCode.LOCKED, "Your account is awaiting approval. Please check your email.", { status: 423 });
  }

  const session = await createSession(user.id, user.role, user.email, {
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.professionalProfile?.slug ? user.identity?.fullName ?? user.email : user.identity?.fullName ?? user.email,
      professionalSlug: user.professionalProfile?.slug ?? null,
      requiresEmailVerification: !user.emailVerified,
    },
    sessionId: session.sessionId,
    expiresAt: session.expiresAt,
  };
}

export async function logoutUser() {
  await destroySession();
  return { success: true as const };
}

// ─── Email verification ──────────────────────────────────────────────────────

export async function verifyEmail(token: string) {
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: await hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "This verification link is invalid or has expired.");
  }
  await prisma.$transaction([
    prisma.emailVerificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { emailVerified: new Date() } }),
  ]);
  return { userId: row.userId };
}

export async function resendVerificationEmail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, identity: { select: { firstName: true } } } });
  if (!user) throw notFound("Account not found.");
  if (user.identity && (user as { emailVerified?: Date }).emailVerified) return { sent: false as const };

  const { token, tokenHash } = await generateOpaqueToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24) },
    }),
  ]);
  const url = absoluteUrl(`/verify-email?token=${token}`);
  await sendMail({
    to: user.email,
    subject: "Confirm your email — ألو المعلم",
    text: `Confirm your email address: ${url}`,
    template: "verify-email",
    data: { firstName: user.identity?.firstName ?? "", verificationUrl: url },
  });
  return { sent: true as const };
}

// ─── Password reset ──────────────────────────────────────────────────────────

const RESET_TTL_MS = 1000 * 60 * 30; // 30 minutes

export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized }, select: { id: true, email: true, identity: { select: { firstName: true } } } });

  // Always answer identically: the endpoint must not confirm whether an
  // address is registered.
  const generic = { sent: true as const, generic: true as const };
  if (!user) return generic;

  const { token, tokenHash } = await generateOpaqueToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);

  const url = absoluteUrl(`/reset-password?token=${token}`);
  await sendMail({
    to: user.email,
    subject: "Reset your password — ألو المعلم",
    text: `You asked to reset your password. Use this link within 30 minutes: ${url}\n\nIf you did not request this, ignore this email.`,
    template: "reset-password",
    data: { firstName: user.identity?.firstName ?? "", resetUrl: url },
  });

  // In development there is no mailbox, so surface the link in the server log
  // (and only there — never in an API response).
  if (isDevelopment) console.info(`[auth] password reset link for ${user.email}: ${url}`);

  return generic;
}

export async function resetPassword(token: string, newPassword: string) {
  if (!isPasswordAcceptable(newPassword)) {
    throw unprocessable("Password must be at least 8 characters.");
  }
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: await hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.attempts >= 5) {
    throw new ApiError(ErrorCode.BAD_REQUEST, "This reset link is invalid or has expired. Please request a new one.");
  }

  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    // A password change invalidates every other session.
    await tx.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.auditLog.create({
      data: { actorId: row.userId, action: "PASSWORD_RESET", targetType: "USER", targetId: row.userId },
    });
  });

  return { userId: row.userId };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
  if (!user) throw notFound("Account not found.");
  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new ApiError(ErrorCode.BAD_REQUEST, "Your current password is incorrect.", { field: "currentPassword" });
  if (!isPasswordAcceptable(newPassword)) throw unprocessable("Password must be at least 8 characters.");
  if (currentPassword === newPassword) throw unprocessable("The new password must be different from the current one.");

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await tx.auditLog.create({
      data: { actorId: userId, action: "PASSWORD_CHANGED", targetType: "USER", targetId: userId },
    });
  });
  await revokeAllUserSessions(userId);
  return { success: true as const };
}

/** Admin-only credential reset; keeps an audit trail. */
export async function adminResetPassword(actorId: string, targetUserId: string) {
  const temporary = `Alo${Math.random().toString(36).slice(2, 8)}!${new Date().getFullYear()}`;
  const passwordHash = await hashPassword(temporary);
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } }),
    prisma.session.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.auditLog.create({
      data: { actorId, action: "ADMIN_PASSWORD_RESET", targetType: "USER", targetId: targetUserId },
    }),
  ]);
  return { temporaryPassword: temporary };
}

export { env };
