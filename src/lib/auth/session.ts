import { cache } from "react";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import type { Role, UserStatus, Locale, VerificationStatus, AvailabilityStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { env, isProduction } from "@/lib/env";
import { issueSessionToken, verifySessionToken } from "./token";

export interface SessionUser {
  id: string;
  email: string;
  phone: string;
  role: Role;
  status: UserStatus;
  locale: Locale;
  emailVerified: Date | null;
  createdAt: Date;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  city: string | null;
  professional: {
    id: string;
    slug: string;
    businessName: string | null;
    headline: string | null;
    city: string;
    verificationStatus: VerificationStatus;
    availabilityStatus: AvailabilityStatus;
    ratingAverage: number;
    ratingCount: number;
    completedJobs: number;
    responseRate: number;
    responseTimeMin: number;
    isFeatured: boolean;
    profileComplete: boolean;
  } | null;
  customer: {
    id: string;
    defaultCity: string | null;
    defaultNeighborhood: string | null;
    defaultAddress: string | null;
  } | null;
}

export interface Session {
  user: SessionUser;
  sessionId: string;
  expiresAt: Date;
}

const SESSION_INCLUDE = {
  identity: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      avatarUrl: true,
      city: true,
    },
  },
  professionalProfile: {
    select: {
      id: true,
      slug: true,
      businessName: true,
      headline: true,
      city: true,
      avatarUrl: true,
      about: true,
      yearsExperience: true,
      verificationStatus: true,
      availabilityStatus: true,
      ratingAverage: true,
      ratingCount: true,
      completedJobs: true,
      responseRate: true,
      responseTimeMin: true,
      isFeatured: true,
      serviceRadiusKm: true,
      phonePublic: true,
    },
  },
  customerProfile: {
    select: {
      id: true,
      defaultCity: true,
      defaultNeighborhood: true,
      defaultAddress: true,
    },
  },
} as const;

type UserWithSessionData = Prisma.UserGetPayload<{ include: typeof SESSION_INCLUDE }>;

function mapUser(user: NonNullable<UserWithSessionData>): SessionUser {
  const pro = user.professionalProfile;
  const identity = user.identity;
  const city = pro?.city ?? identity?.city ?? user.customerProfile?.defaultCity ?? null;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    locale: user.locale,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    firstName: identity?.firstName ?? "",
    lastName: identity?.lastName ?? "",
    name: pro?.businessName?.trim() || identity?.fullName?.trim() || user.email.split("@")[0]!,
    avatarUrl: pro?.avatarUrl ?? identity?.avatarUrl ?? null,
    city,
    professional: pro
      ? {
          id: pro.id,
          slug: pro.slug,
          businessName: pro.businessName,
          headline: pro.headline,
          city: pro.city,
          verificationStatus: pro.verificationStatus,
          availabilityStatus: pro.availabilityStatus,
          ratingAverage: Number(pro.ratingAverage),
          ratingCount: pro.ratingCount,
          completedJobs: pro.completedJobs,
          responseRate: pro.responseRate,
          responseTimeMin: pro.responseTimeMin,
          isFeatured: pro.isFeatured,
          profileComplete: Boolean(
            pro.headline && pro.about && pro.about.length > 40 && pro.city
          ),
        }
      : null,
    customer: user.customerProfile
      ? {
          id: user.customerProfile.id,
          defaultCity: user.customerProfile.defaultCity,
          defaultNeighborhood: user.customerProfile.defaultNeighborhood,
          defaultAddress: user.customerProfile.defaultAddress,
        }
      : null,
  };
}

export function sessionCookieName() {
  return env.AUTH_COOKIE_NAME;
}

export async function readSessionCookie(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(sessionCookieName())?.value ?? null;
  } catch {
    // Called outside a request scope (scripts, tests).
    return null;
  }
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires: expiresAt,
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(sessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Persists a session row, issues the JWT and sets the cookie.
 * Called by register/login and by any future OAuth provider adapter.
 */
export async function createSession(userId: string, role: Role, email: string, meta?: { ip?: string; userAgent?: string }) {
  const sessionId = crypto.randomUUID();
  const { token, expiresAt } = await issueSessionToken({ userId, sessionId, role, email });

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      tokenHash: hashForStorage(token),
      expiresAt,
      ipAddress: meta?.ip ?? null,
      userAgent: meta?.userAgent?.slice(0, 500) ?? null,
    },
  });

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => null);
  await setSessionCookie(token, expiresAt);

  return { token, sessionId, expiresAt };
}

function hashForStorage(token: string) {
  // Only a prefix is stored: enough to look a row up, not enough to replay.
  return token.slice(-48);
}

/**
 * Per-request memoised session resolver (React `cache`), so a page and its
 * nested server components share one DB round-trip.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = await readSessionCookie();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const sessionRow = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { id: true, revokedAt: true, expiresAt: true, userId: true },
  });
  if (!sessionRow || sessionRow.revokedAt || sessionRow.expiresAt < new Date()) return null;
  if (sessionRow.userId !== payload.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub, deletedAt: null },
    include: SESSION_INCLUDE,
  });
  if (!user) return null;
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") return null;

  return { user: mapUser(user), sessionId: sessionRow.id, expiresAt: sessionRow.expiresAt };
});

/** Same as `getSession` but skips the session-table check (scripts/tests). */
export async function getUserById(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: SESSION_INCLUDE });
  if (!user) return null;
  return mapUser(user);
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AuthenticationError();
  }
  return session.user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new AuthorizationError();
  }
  return user;
}

export class AuthenticationError extends Error {
  readonly code = "UNAUTHENTICATED";
  readonly status = 401;
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  readonly code = "FORBIDDEN";
  readonly status = 403;
  constructor(message = "You are not authorized to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Revokes a single session (logout) or every session for a user (suspension). */
export async function revokeSession(sessionId: string) {
  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

export async function destroySession() {
  const token = await readSessionCookie();
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.sid) await revokeSession(payload.sid);
  }
  await clearSessionCookie();
}
