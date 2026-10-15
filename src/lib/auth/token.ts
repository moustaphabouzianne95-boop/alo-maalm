import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";
import type { Role } from "@prisma/client";

/**
 * Stateless session tokens (JWT, HS256) backed by a server-side `Session` row.
 *
 * The JWT keeps the hot path (every request) free of a DB read for *identity*,
 * while the persisted row gives us instant revocation on logout, password
 * change, suspension or admin action.
 */

const encoder = new TextEncoder();

function signingKey() {
  return encoder.encode(env.AUTH_SECRET);
}

export interface SessionTokenPayload extends JWTPayload {
  /** Subject — the user id. */
  sub: string;
  sid: string;
  role: Role;
  email: string;
}

export interface IssueTokenInput {
  userId: string;
  sessionId: string;
  role: Role;
  email: string;
  maxAgeSeconds?: number;
}

export async function issueSessionToken(input: IssueTokenInput): Promise<{ token: string; expiresAt: Date }> {
  const maxAge = input.maxAgeSeconds ?? env.AUTH_SESSION_MAX_AGE;
  const expiresAt = new Date(Date.now() + maxAge * 1000);
  const token = await new SignJWT({
    sid: input.sessionId,
    role: input.role,
    email: input.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setIssuer("alomaalem")
    .setAudience("alomaalem-web")
    .setExpirationTime(expiresAt)
    .sign(signingKey());

  return { token, expiresAt };
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: "alomaalem",
      audience: "alomaalem-web",
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.sid !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return payload as SessionTokenPayload;
  } catch {
    return null;
  }
}

/** Opaque, high-entropy tokens for password reset / email verification. */
export async function generateOpaqueToken(): Promise<{ token: string; tokenHash: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = base64Url(bytes);
  return { token, tokenHash: await hashToken(token) };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Tokens are stored *hashed*: a database leak must not allow resetting
 * somebody's password. Uses WebCrypto so the same helper works on the server,
 * in scripts and at the edge.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function newUuid(): string {
  return crypto.randomUUID();
}
