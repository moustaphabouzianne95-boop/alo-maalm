import { ApiClientError } from "@/lib/api/client";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Maps server validation *codes* (stable, language-neutral) onto dictionary
 * keys, so a French user sees French field errors even though the API always
 * answers in English codes.
 */
export const SERVER_MESSAGE_KEYS: Record<string, string> = {
  identifier_required: "validation.required",
  password_required: "validation.required",
  first_name_required: "validation.required",
  last_name_required: "validation.required",
  terms_required: "validation.required",
  invalid_email: "validation.email",
  invalid_phone: "validation.phone",
  invalid_moroccan_phone: "validation.phone",
  password_too_short: "validation.passwordShort",
  password_too_long: "validation.maxLength",
  password_needs_letter_and_digit: "validation.passwordWeak",
  unknown_city: "validation.city",
  city_required_for_professional: "validation.city",
  invalid_token: "auth.reset.invalid",
  invalid_credentials: "auth.error.invalidCredentials",
  email_taken: "auth.error.emailTaken",
  phone_taken: "auth.error.phoneTaken",
  title_too_short: "validation.minLength",
  title_too_long: "validation.maxLength",
  description_too_short: "validation.minLength",
  description_too_long: "validation.maxLength",
  budget_max_below_min: "validation.budgetRange",
  date_in_past: "validation.dateFuture",
  invalid_category: "validation.required",
  invalid_date: "validation.date",
  current_password_required: "validation.required",
  money_must_be_positive: "validation.positiveNumber",
  price_max_below_min: "validation.budgetRange",
  duration_max_below_min: "validation.budgetRange",
  message_too_short: "validation.minLength",
  message_too_long: "validation.maxLength",
  reply_too_short: "validation.minLength",
};

interface ApplyOptions {
  /** Per-endpoint overrides of the API error code → dictionary key map. */
  codeKeys?: Record<string, string>;
  rootFallback?: string;
}

/**
 * Turns an API failure into either field errors (returns `null`) or a form-level
 * message (returns the translated string). Field paths come from the server's
 * `details.issues`/`details.field` — never from string-matching messages.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  t: (key: string, vars?: Record<string, string | number>) => string,
  options: ApplyOptions = {}
): string | null {
  if (!(error instanceof ApiClientError)) {
    return t(options.rootFallback ?? "common.genericError");
  }

  const details = (error.details ?? undefined) as
    | { issues?: { path?: string; message?: string }[]; field?: string }
    | undefined;

  if ((error.code === "VALIDATION_ERROR" || error.code === "UNPROCESSABLE_ENTITY") && details?.issues?.length) {
    for (const issue of details.issues) {
      if (!issue.path) continue;
      const key = SERVER_MESSAGE_KEYS[issue.message ?? ""] ?? "validation.required";
      setError(issue.path as Path<T>, { message: t(key) });
    }
    return null;
  }

  if (error.code === "CONFLICT" && details?.field) {
    const key = SERVER_MESSAGE_KEYS[details.field === "phone" ? "phone_taken" : "email_taken"];
    setError(details.field as Path<T>, { message: t(key) });
    return null;
  }

  const codeKey = options.codeKeys?.[String(error.code)];
  if (codeKey) return t(codeKey);
  if (error.code === "NETWORK_ERROR") return t("common.networkError");
  return t(options.rootFallback ?? "common.genericError");
}

/** Open-redirect guard for `?next=` — only same-origin relative paths pass. */
export function safeNextPath(next?: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return null;
  return next;
}
