import { errorMessageKey, isApiClientError } from "@/lib/api/client";

/** Picks a dictionary key for a failed mutation. Never surfaces the server's English sentence. */
export function mutationMessage(
  error: unknown,
  t: (key: string) => string,
  codeKeys?: Record<string, string>
): string {
  if (!isApiClientError(error)) return t("common.networkError");
  const mapped = codeKeys?.[String(error.code)];
  if (mapped) return t(mapped);
  return t(errorMessageKey(String(error.code)));
}
