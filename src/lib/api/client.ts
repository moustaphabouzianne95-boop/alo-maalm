/**
 * Browser-side API client.
 *
 * Mirrors the server envelope exactly, so a mutation reads the same shape
 * whether it ran in a server action or through `fetch`. Every non-2xx becomes
 * an `ApiClientError` carrying the server's `code`, which lets UI copy be
 * chosen by code rather than by string matching.
 */
import type { ApiResponse } from "./respond";
import type { ErrorCodeValue } from "./errors";

export class ApiClientError extends Error {
  readonly code: ErrorCodeValue | string;
  readonly status: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(code: string, message: string, status: number, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export type Query = Record<string, string | number | boolean | null | undefined | string[]>;

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        value.forEach((v) => v && url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return `${url.pathname}${url.search}`;
}

interface RequestOptions {
  query?: Query;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Skip throwing so the caller can inspect the envelope (used by health checks). */
  raw?: boolean;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);
  const isForm = options.form instanceof FormData;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: options.signal,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(isForm ? {} : options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: isForm ? options.form : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiClientError("NETWORK_ERROR", "Connection lost. Check your internet and retry.", 0);
  }

  if (response.status === 204) return undefined as T;

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.success === false) {
    const errorBody = payload && payload.success === false ? payload.error : undefined;
    throw new ApiClientError(
      errorBody?.code ?? "INTERNAL_ERROR",
      errorBody?.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorBody?.details,
      payload && "requestId" in payload ? payload.requestId : undefined
    );
  }

  return payload.data;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body" | "form">) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  postForm: <T>(path: string, form: FormData, options?: Omit<RequestOptions, "body" | "form">) =>
    request<T>("POST", path, { ...options, form }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  patchForm: <T>(path: string, form: FormData, options?: Omit<RequestOptions, "body" | "form">) =>
    request<T>("PATCH", path, { ...options, form }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, options),
};

/** Maps a server error code to an i18n key so copy stays in the dictionaries. */
export function errorMessageKey(code: string): string {
  switch (code) {
    case "UNAUTHENTICATED":
      return "common.unauthorized";
    case "FORBIDDEN":
      return "common.forbidden";
    case "NOT_FOUND":
      return "common.notFound";
    case "RATE_LIMITED":
      return "auth.error.tooManyAttempts";
    case "VALIDATION_ERROR":
    case "UNPROCESSABLE_ENTITY":
      return "validation.required";
    case "NETWORK_ERROR":
      return "common.networkError";
    default:
      return "common.genericError";
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}
