import type { Role } from "@prisma/client";

/**
 * Edge-safe RBAC primitives.
 *
 * Deliberately free of Prisma / Zod / server-only imports so `src/proxy.ts`
 * can enforce route gating at the edge. Resource-level policies live in
 * `lib/permissions/index.ts`.
 */
export const ROLES: Role[] = ["CUSTOMER", "PROFESSIONAL", "ADMIN"];

/** Route prefixes per role — mirrored by the guards in `withApi`. */
export const ROUTE_GUARDS = {
  "/dashboard": ["CUSTOMER", "PROFESSIONAL", "ADMIN"],
  "/professional": ["PROFESSIONAL", "ADMIN"],
  "/admin": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type GuardedPrefix = keyof typeof ROUTE_GUARDS;

export function roleForPath(pathname: string): readonly Role[] | null {
  const match = (Object.keys(ROUTE_GUARDS) as GuardedPrefix[]).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return match ? ROUTE_GUARDS[match] : null;
}

/** Where a user lands after signing in, based on their role. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PROFESSIONAL":
      return "/professional";
    default:
      return "/dashboard";
  }
}

export function canAccessRoleArea(role: Role | undefined | null, pathname: string): boolean {
  if (!role) return false;
  const allowed = roleForPath(pathname);
  if (!allowed) return true;
  return (allowed as readonly Role[]).includes(role);
}

export function isGuardedPath(pathname: string): boolean {
  return roleForPath(pathname) !== null;
}
