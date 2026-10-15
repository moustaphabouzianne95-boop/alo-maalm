import { NextResponse, type NextRequest } from "next/server";
import { verifyEdgeSession, sessionCookieName } from "@/lib/auth/edge";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { canAccessRoleArea, homePathForRole, isGuardedPath } from "@/lib/permissions/roles";

/**
 * Edge proxy (Next.js 16 renamed `middleware`) — the *first* line of defence,
 * not the only one.
 *
 * Responsibilities:
 *   1. Locale resolution: `?lang=` → cookie → Arabic default, exposed to the
 *      app through the `x-locale` request header so server components can
 *      render localised copy without an extra DB read.
 *   2. Route-level role gating for `/dashboard`, `/professional`, `/admin`.
 *      The token is verified by signature only (no DB access at the edge);
 *      every mutation re-checks authorisation server-side in `withApi`, so a
 *      stale-but-valid token can never perform an action it lost the right to.
 *   3. Redirecting signed-in users away from the auth pages.
 */

const PUBLIC_AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);

  // ── Locale ──────────────────────────────────────────────────────────────
  const queryLang = request.nextUrl.searchParams.get("lang");
  const cookieLang = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(queryLang) ? queryLang : isLocale(cookieLang) ? cookieLang : "ar";
  headers.set("x-locale", locale);

  const response = NextResponse.next({ request: { headers } });

  if (isLocale(queryLang)) {
    // Persist the explicit choice so the next navigation keeps the language.
    response.cookies.set(LOCALE_COOKIE, queryLang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.APP_ENV === "production",
    });
  }

  // ── Route protection ────────────────────────────────────────────────────
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const token = request.cookies.get(sessionCookieName())?.value;
  const payload = token ? await verifyEdgeSession(token) : null;

  if (isPublicAuthPath) {
    if (payload) {
      const url = request.nextUrl.clone();
      url.pathname = homePathForRole(payload.role);
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const requiresAuth = isGuardedPath(pathname);
  const allowedRoles = canAccessRoleArea(payload?.role ?? null, pathname);

  if (requiresAuth && !payload) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (payload && requiresAuth && !allowedRoles) {
    const url = request.nextUrl.clone();
    url.pathname = homePathForRole(payload.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip the middleware for the API (routes do their own auth) except uploads,
  // and for static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|uploads).*)",
  ],
};
