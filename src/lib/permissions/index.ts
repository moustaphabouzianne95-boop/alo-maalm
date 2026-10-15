import type { Role } from "@prisma/client";
import { forbidden } from "@/lib/api/errors";

/**
 * Role-based access control.
 *
 * Two layers share this module:
 *   • `src/proxy.ts` protects *routes* (fast edge redirect for browsers)
 *   • `withApi` + these guards protect *operations* (the real boundary)
 *
 * Hiding a button in the UI is never an authorisation decision.
 */

export type Actor = { id: string; role: Role } | null | undefined;

export {
  ROLES,
  ROUTE_GUARDS,
  roleForPath,
  homePathForRole,
  canAccessRoleArea,
  isGuardedPath,
  type GuardedPrefix,
} from "./roles";

// ─── Resource-level policies ─────────────────────────────────────────────────

export function canManageService(actor: Actor, service: { ownerUserId: string }): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.role === "PROFESSIONAL" && actor.id === service.ownerUserId;
}

export function canManageRequest(actor: Actor, request: { customerId: string }): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.id === request.customerId;
}

export function canViewRequest(actor: Actor, request: { customerId: string }): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  // Professionals may view any request that is open for offers.
  if (actor.role === "PROFESSIONAL") return true;
  return actor.id === request.customerId;
}

export function canManageOffer(actor: Actor, offer: { professionalId: string }): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.id === offer.professionalId;
}

export function canDecideOffer(actor: Actor, request: { customerId: string }): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.id === request.customerId;
}

export function canManageBooking(
  actor: Actor,
  booking: { customerId: string; professionalId: string }
): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.id === booking.customerId || actor.id === booking.professionalId;
}

export function canAccessConversation(
  actor: Actor,
  conversation: { customerId: string; professionalId: string }
): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  return actor.id === conversation.customerId || actor.id === conversation.professionalId;
}

export function canWriteReview(
  actor: Actor,
  booking: { customerId: string; status: string }
): boolean {
  if (!actor) return false;
  return actor.id === booking.customerId && booking.status === "COMPLETED";
}

export function canModerate(actor: Actor): boolean {
  return actor?.role === "ADMIN";
}

export function canManageCategories(actor: Actor): boolean {
  return actor?.role === "ADMIN";
}

/** Throws a 403 `ApiError` when the policy fails — use inside route handlers. */
export function assert(allowed: boolean, message?: string): void {
  if (!allowed) throw forbidden(message ?? "You are not authorized to perform this action.");
}

export function assertRole(actor: Actor, ...roles: Role[]): void {
  if (!actor) throw forbidden();
  assert(roles.includes(actor.role), `This action requires one of: ${roles.join(", ")}.`);
}

export function assertOwnership(actor: Actor, ownerId: string): void {
  if (!actor) throw forbidden();
  assert(actor.role === "ADMIN" || actor.id === ownerId);
}
