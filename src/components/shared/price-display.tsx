"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { PricingType } from "@prisma/client";

export interface PriceDisplayProps {
  min?: number | null;
  max?: number | null;
  pricingType?: PricingType | string | null;
  /** Show the "Starting from" / "Per hour" prefix. */
  withPrefix?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  prefixClassName?: string;
}

const SIZES = { sm: "text-sm", md: "text-base", lg: "text-xl" } as const;

/**
 * Renders MAD prices per the brand rule (`250 MAD`) and adapts the prefix to
 * the service's pricing type. Never renders a dollar sign.
 */
export function PriceDisplay({
  min,
  max,
  pricingType,
  withPrefix = true,
  size = "md",
  className,
  prefixClassName,
}: PriceDisplayProps) {
  const { t, formatMoney, formatMoneyRange, locale } = useI18n();

  if (pricingType === "CUSTOM_QUOTE" || (min == null && max == null)) {
    return <span className={cn(SIZES[size], "font-semibold text-foreground", className)}>{t("common.negotiable")}</span>;
  }

  const prefixKey =
    pricingType === "HOURLY"
      ? "common.perHour"
      : pricingType === "FIXED"
        ? null
        : "common.startingFrom";

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      {withPrefix && prefixKey && (
        <span className={cn("text-xs font-normal text-muted-foreground", prefixClassName)}>{t(prefixKey)}</span>
      )}
      <span className={cn(SIZES[size], "font-bold text-foreground tabular-nums")} dir="ltr">
        {max != null && Number(max) > Number(min ?? 0)
          ? formatMoneyRange(min ?? 0, max)
          : formatMoney(Number(min ?? 0))}
      </span>
      {withPrefix && pricingType === "HOURLY" && (
        <span className={cn("text-xs font-normal text-muted-foreground", prefixClassName)}>{t("common.perHour")}</span>
      )}
      {locale === "ar" ? null : null}
    </span>
  );
}

/** Server-renderable variant: caller passes already-localised strings. */
export function PriceText({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("font-bold tabular-nums", className)} dir="ltr">
      {value}
    </span>
  );
}
