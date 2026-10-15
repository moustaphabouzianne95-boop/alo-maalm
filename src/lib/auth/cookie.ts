/**
 * Edge-safe auth constants.
 *
 * `lib/env` pulls in Zod + server-only config, so the edge proxy imports this
 * tiny module instead. Both read the same `AUTH_COOKIE_NAME`.
 */
export const DEFAULT_COOKIE_NAME = "alomaalem_session";

export function sessionCookieName(): string {
  return process.env.AUTH_COOKIE_NAME ?? DEFAULT_COOKIE_NAME;
}
