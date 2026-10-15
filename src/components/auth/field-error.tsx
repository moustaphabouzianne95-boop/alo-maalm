"use client";

import { useFormField } from "@/components/ui/form";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Like shadcn's `FormMessage`, but runs the error text through the dictionary:
 * Zod schemas emit i18n *keys* as messages, and server errors arrive already
 * translated — `t()` is idempotent for plain text, so both render correctly
 * and update when the visitor switches language.
 */
export function FieldError({ className }: { className?: string }) {
  const { error, formMessageId } = useFormField();
  const { t } = useI18n();
  if (!error?.message) return null;
  return (
    <p id={formMessageId} className={className ?? "text-xs font-medium text-destructive"} role="alert">
      {t(String(error.message))}
    </p>
  );
}
