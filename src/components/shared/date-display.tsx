"use client";

import * as React from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface DateDisplayProps {
  value: Date | string | number | null | undefined;
  variant?: "date" | "datetime" | "time" | "relative";
  className?: string;
  /** Prefix rendered before the formatted value (e.g. an icon). */
  children?: React.ReactNode;
}

/** Locale-aware date rendering. `relative` produces "قبل 3 ساعات" / "il y a 3 h". */
export function DateDisplay({ value, variant = "date", className, children }: DateDisplayProps) {
  const { formatDate, formatDateTime, formatTime, formatRelative } = useI18n();

  if (value == null || value === "") {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  const text =
    variant === "datetime"
      ? formatDateTime(value)
      : variant === "time"
        ? formatTime(value)
        : variant === "relative"
          ? formatRelative(value)
          : formatDate(value);

  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      {children}
      <time dateTime={value instanceof Date ? value.toISOString() : String(value)}>{text}</time>
    </span>
  );
}
