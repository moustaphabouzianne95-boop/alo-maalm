import { jwtVerify, type JWTPayload } from "jose";
import type { Role } from "@prisma/client";
import { sessionCookieName } from "./cookie";

/**
 * Edge-runtime session verification.
 *
 * Uses WebCrypto only (via `jose`) — no `node:crypto`, no Prisma — so it can
 * run in Next's edge proxy for fast route gating. Signature verification
 * proves *who* the caller claims to be; every write path re-checks the session
 * against the database in `lib/auth/session.ts`.
 */
export interface EdgeSessionPayload extends JWTPayload {
  sub: string;
  sid: string;
  role: Role;
  email: string;
}

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyEdgeSession(token: string): Promise<EdgeSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(), {
      issuer: "alomaalem",
      audience: "alomaalem-web",
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.sid !== "string" || typeof payload.role !== "string") return null;
    return payload as EdgeSessionPayload;
  } catch {
    return null;
  }
}

export { sessionCookieName };
