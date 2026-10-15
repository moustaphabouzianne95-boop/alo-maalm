import * as React from "react";
import { cn } from "@/lib/utils";
import { dotClasses, toneClasses, toneFor, type StatusDomain, type StatusTone } from "./status-config";

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  domain?: StatusDomain;
  value: string | null | undefined;
  /** Pre-localised label. Server components pass `t(prefix + value)`. */
  label?: string;
  tone?: StatusTone;
  dot?: boolean;
  size?: "sm" | "md";
}

/**
 * Colour-coded status pill used for requests, offers, bookings, users,
 * verification, reports… Colours come from `status-config.ts`.
 */
export function StatusBadge({
  domain,
  value,
  label,
  tone,
  dot = true,
  size = "md",
  className,
  ...props
}: StatusBadgeProps) {
  if (!value) return null;
  const resolvedTone = tone ?? (domain ? toneFor(domain, value) : "muted");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        toneClasses(resolvedTone),
        className
      )}
      {...props}
    >
      {dot && <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotClasses(resolvedTone))} />}
      {label ?? value}
    </span>
  );
}
