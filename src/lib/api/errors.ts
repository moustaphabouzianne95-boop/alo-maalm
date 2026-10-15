import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/**
 * Canonical error taxonomy.
 *
 * Every API route funnels failures through `handleApiError`, so clients always
 * receive `{ success: false, error: { code, message, details? } }` with a
 * correct HTTP status. Stack traces never leave the server.
 */
export const ErrorCode = {
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  RATE_LIMITED: "RATE_LIMITED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  LOCKED: "LOCKED",
  UNPROCESSABLE: "UNPROCESSABLE_ENTITY",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ERROR_STATUS: Record<ErrorCodeValue, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  METHOD_NOT_ALLOWED: 405,
  RATE_LIMITED: 429,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  LOCKED: 423,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export interface ApiErrorBody {
  code: ErrorCodeValue;
  /** Human-readable, safe to show. Localisation happens on the client. */
  message: string;
  details?: unknown;
}

export interface ApiErrorOptions {
  status?: number;
  details?: unknown;
  expose?: boolean;
  /** Convenience: merged into `details.field` for single-field errors. */
  field?: string;
  fields?: string[];
}

export class ApiError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(code: ErrorCodeValue, message: string, options?: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = options?.status ?? ERROR_STATUS[code] ?? 500;
    // `field`/`fields` are folded into details so form clients can highlight the
    // offending input without a second error shape.
    const extra =
      options?.field !== undefined || options?.fields !== undefined
        ? { ...(options?.field !== undefined ? { field: options.field } : {}), ...(options?.fields ? { fields: options.fields } : {}) }
        : undefined;
    this.details = extra ? { ...(options?.details as object | undefined), ...extra } : options?.details;
    // 5xx messages are replaced before reaching the client.
    this.expose = options?.expose ?? this.status < 500;
  }

  toJSON(): ApiErrorBody {
    return {
      code: this.code,
      message: this.expose ? this.message : "An unexpected error occurred. Please try again.",
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(ErrorCode.BAD_REQUEST, message, { details });
export const validationError = (message: string, details?: unknown) =>
  new ApiError(ErrorCode.VALIDATION_ERROR, message, { details });
export const unauthenticated = (message = "You are not authorized to perform this action.") =>
  new ApiError(ErrorCode.UNAUTHENTICATED, message);
export const forbidden = (message = "You are not authorized to perform this action.") =>
  new ApiError(ErrorCode.FORBIDDEN, message);
export const notFound = (message = "The requested resource was not found.") =>
  new ApiError(ErrorCode.NOT_FOUND, message);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(ErrorCode.CONFLICT, message, { details });
export const tooManyRequests = (message = "Too many requests. Please slow down.", details?: unknown) =>
  new ApiError(ErrorCode.RATE_LIMITED, message, { details });
export const unprocessable = (message: string, details?: unknown) =>
  new ApiError(ErrorCode.UNPROCESSABLE, message, { details });

/**
 * Translates infrastructure errors (Prisma, Zod, HTTP) into the canonical
 * taxonomy. Anything unrecognised becomes a generic 500 — the original error
 * is logged server-side with a correlation id, never returned.
 */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return new ApiError(ErrorCode.VALIDATION_ERROR, "The submitted data is not valid.", {
      details: { issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const target = (error.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target : [target];
        return new ApiError(
          ErrorCode.CONFLICT,
          `A record with the same ${fields.join(", ")} already exists.`,
          { details: { fields } }
        );
      }
      case "P2003":
        return new ApiError(ErrorCode.BAD_REQUEST, "This operation violates a related record constraint.", {
          details: { field: error.meta?.field_name },
        });
      case "P2025":
        return new ApiError(ErrorCode.NOT_FOUND, "The requested resource was not found.");
      case "P2000":
        return new ApiError(ErrorCode.BAD_REQUEST, "A provided value is too long for its column.", {
          details: { column: error.meta?.column_name },
        });
      case "P2034":
        return new ApiError(ErrorCode.CONFLICT, "A concurrent write conflict occurred. Please retry.");
      default:
        return new ApiError(ErrorCode.BAD_REQUEST, "The request could not be processed.", {
          details: { code: error.code },
        });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ApiError(ErrorCode.BAD_REQUEST, "The request payload does not match the expected shape.");
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new ApiError(ErrorCode.SERVICE_UNAVAILABLE, "A downstream service is unavailable.");
  }

  const message = error instanceof Error ? error.message : String(error);
  return new ApiError(ErrorCode.INTERNAL_ERROR, message, { expose: false });
}
