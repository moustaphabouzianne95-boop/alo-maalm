import { ApiError, ErrorCode } from "./errors";

/** True when the service refused the read because the row is missing or not ours. */
export function isMissingResource(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ErrorCode.NOT_FOUND || error.code === ErrorCode.FORBIDDEN)
  );
}

/**
 * Converts a missing/forbidden service error into `null` so the page can call
 * `notFound()` itself. Next only sets the 404 status when `notFound()` is
 * invoked directly from the page, not from inside a helper's catch block.
 */
export async function loadOrNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (isMissingResource(error)) return null;
    throw error;
  }
}
