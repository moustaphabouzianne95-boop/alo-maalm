import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { normalizeError, ERROR_STATUS, type ApiErrorBody, type ErrorCodeValue } from "./errors";

/**
 * Uniform API envelope:
 *   success → `{ success: true, data, meta? }`
 *   failure → `{ success: false, error: { code, message, details? } }`
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  requestId?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

const GENERIC_500 = "An unexpected error occurred. Please try again.";

export function ok<T>(data: T, init?: { meta?: Record<string, unknown>; status?: number; headers?: Record<string, string> }) {
  return NextResponse.json<ApiSuccess<T>>(
    { success: true, data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200, headers: init?.headers }
  );
}

export function created<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, ...(meta ? { meta } : {}) }, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function apiError(code: ErrorCodeValue, message: string, details?: unknown, status?: number) {
  const body: ApiFailure = { success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
  return NextResponse.json(body, { status: status ?? ERROR_STATUS[code] ?? 500 });
}

/**
 * Central error funnel. Logs with a correlation id (returned in the payload so
 * support can trace a failing request) and never leaks internals.
 */
export function fail(error: unknown, context?: string) {
  const apiErrorInstance = normalizeError(error);
  const requestId = randomUUID().slice(0, 8);

  if (apiErrorInstance.status >= 500) {
    console.error(`[api] ${context ?? "request"} failed (${requestId}):`, error);
  } else if (process.env.APP_ENV === "development" && apiErrorInstance.status >= 400) {
    console.warn(`[api] ${context ?? "request"} → ${apiErrorInstance.status} ${apiErrorInstance.code} (${requestId})`);
  }

  const body: ApiFailure = {
    success: false,
    error: {
      code: apiErrorInstance.code,
      message: apiErrorInstance.status >= 500 ? GENERIC_500 : apiErrorInstance.message,
      ...(apiErrorInstance.details !== undefined && apiErrorInstance.status < 500
        ? { details: apiErrorInstance.details }
        : {}),
    },
    requestId,
  };

  return NextResponse.json(body, {
    status: apiErrorInstance.status,
    headers: apiErrorInstance.code === "METHOD_NOT_ALLOWED" ? { Allow: "" } : undefined,
  });
}

export function methodNotAllowed(allowed: string[]) {
  return NextResponse.json<ApiFailure>(
    { success: false, error: { code: "METHOD_NOT_ALLOWED", message: `Allowed methods: ${allowed.join(", ")}` } },
    { status: 405, headers: { Allow: allowed.join(", ") } }
  );
}
