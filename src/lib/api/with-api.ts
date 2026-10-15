import { NextResponse, type NextRequest } from "next/server";
import { ZodType } from "zod";
import type { Role } from "@prisma/client";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { ApiError, ErrorCode, forbidden, unauthenticated } from "./errors";
import { fail, methodNotAllowed } from "./respond";
import { rateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

/**
 * Next only passes a second argument to route handlers that declare dynamic
 * segments, so this is optional: static routes call the handler with just the
 * request.
 */
export type ApiContext = { params: Promise<Record<string, string | string[]>> } | undefined;

export interface RouteOptions<TQuery = unknown, TBody = unknown> {
  methods: ("GET" | "POST" | "PATCH" | "PUT" | "DELETE")[];
  /** `null` → public, `[]` → any authenticated user, `["ADMIN"]` → role list. */
  auth?: Role[] | null;
  querySchema?: ZodType<TQuery>;
  bodySchema?: ZodType<TBody>;
  /** Rate-limit bucket; `false` disables it for this route. */
  rateLimit?: string | false;
  rateLimitMax?: number;
  /** Extra pre-flight check after authn/authz (ownership, resource state…). */
  guard?: (ctx: RouteContext<TQuery, TBody>) => Promise<void> | void;
}

export interface RouteContext<TQuery = unknown, TBody = unknown> {
  req: NextRequest;
  params: Record<string, string>;
  query: TQuery;
  body: TBody;
  user: SessionUser | null;
  ip: string;
}

export type RouteHandler<TQuery = unknown, TBody = unknown> = (
  ctx: RouteContext<TQuery, TBody>
) => Promise<NextResponse> | NextResponse;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

async function resolveParams(context: ApiContext): Promise<Record<string, string>> {
  if (!context?.params) return {};
  const raw = await context.params;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = Array.isArray(value) ? value.join("/") : value;
  }
  return out;
}

/**
 * Wraps a route handler with, in order:
 *   1. HTTP method allow-list
 *   2. Rate limiting (keyed by IP, or by user id when authenticated)
 *   3. Authentication + role authorisation (never trusts client-supplied role)
 *   4. Query/body validation with Zod
 *   5. Custom guard (ownership etc.)
 *   6. Uniform error envelope
 */
export function withApi<TQuery = unknown, TBody = unknown>(
  options: RouteOptions<TQuery, TBody>,
  handler: RouteHandler<TQuery, TBody>
) {
  const wrapped = async (req: NextRequest, context: ApiContext) => {
    try {
      if (!options.methods.includes(req.method as never)) {
        return methodNotAllowed(options.methods);
      }

      const params = await resolveParams(context);
      const ip = clientIp(req);

      // ── Session ──────────────────────────────────────────────────────────
      const session = options.auth === null ? null : await getSession();

      if (options.auth !== null && !session) {
        throw unauthenticated();
      }
      if (options.auth && options.auth.length > 0 && session && !options.auth.includes(session.user.role)) {
        throw forbidden();
      }
      if (session?.user.status === "SUSPENDED") {
        throw new ApiError(ErrorCode.LOCKED, "This account has been suspended.", { status: 423 });
      }

      // ── Rate limit ───────────────────────────────────────────────────────
      // A shared secret lets the test harness (and CI) run repeatedly without
      // tripping the deliberately tight auth limits. Nothing is bypassed unless
      // the operator explicitly configured the secret.
      const bypassSecret = process.env.RATE_LIMIT_BYPASS_SECRET;
      const bypassed =
        Boolean(bypassSecret) && req.headers.get("x-rate-limit-bypass") === bypassSecret;

      if (options.rateLimit !== false && !bypassed) {
        const bucket = options.rateLimit ?? "api";
        const identifier = session?.user.id ?? ip;
        const limit = await rateLimit(bucket, `${identifier}:${req.nextUrl.pathname}`, options.rateLimitMax);
        if (!limit.success) {
          return NextResponse.json(
            {
              success: false,
              error: { code: ErrorCode.RATE_LIMITED, message: "Too many requests. Please try again shortly." },
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(Math.ceil(limit.resetInMs / 1000)),
                "X-RateLimit-Limit": String(limit.limit),
                "X-RateLimit-Remaining": String(limit.remaining),
              },
            }
          );
        }
      }

      // ── Query validation ─────────────────────────────────────────────────
      let query = undefined as TQuery;
      if (options.querySchema) {
        const rawQuery = Object.fromEntries(req.nextUrl.searchParams.entries());
        query = (await options.querySchema.parseAsync(rawQuery)) as TQuery;
      }

      // ── Body validation ──────────────────────────────────────────────────
      // Only methods that conventionally carry a payload are parsed. Routes such
      // as `/api/favorites` expose an optional write schema alongside a public
      // GET; demanding a content-type for the GET answered 415.
      let body = undefined as TBody;
      const bodyBearing = req.method === "POST" || req.method === "PATCH" || req.method === "PUT";
      if (options.bodySchema && bodyBearing) {
        const contentType = req.headers.get("content-type") ?? "";
        let parsed: unknown;
        if (contentType.includes("application/json")) {
          const text = await req.text();
          if (!text.trim()) {
            throw new ApiError(ErrorCode.BAD_REQUEST, "A JSON request body is required.");
          }
          try {
            parsed = JSON.parse(text);
          } catch {
            throw new ApiError(ErrorCode.BAD_REQUEST, "The request body is not valid JSON.");
          }
        } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
          // Flattened to a plain object so the same Zod schemas validate both
          // JSON and form submissions. Routes that need File objects read
          // `req.formData()` themselves and skip `bodySchema`.
          parsed = Object.fromEntries(await req.formData());
        } else {
          throw new ApiError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, `Unsupported content type: ${contentType || "none"}`);
        }
        body = (await options.bodySchema.parseAsync(parsed)) as TBody;
      }

      const ctx: RouteContext<TQuery, TBody> = {
        req,
        params,
        query,
        body,
        user: session?.user ?? null,
        ip,
      };

      if (options.guard) await options.guard(ctx);

      return await handler(ctx);
    } catch (error) {
      return fail(error, `${req.method} ${new URL(req.url).pathname}`);
    }
  };

  // Every verb is exported and funnels through `wrapped`, which answers 405 for
  // anything outside the allow-list. Exporting a bare Response instead would
  // make Next treat it as a handler and 500 on the wrong verb.
  return { GET: wrapped, POST: wrapped, PATCH: wrapped, PUT: wrapped, DELETE: wrapped };
}

/** Convenience for JSON body parsing in routes that need raw control. */
export async function readJson<T = unknown>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(ErrorCode.BAD_REQUEST, "The request body is not valid JSON.");
  }
}

export function publicBaseUrl(req: NextRequest) {
  return env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}
