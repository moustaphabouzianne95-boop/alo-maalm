import * as React from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VerifiedBadgeProps {
  verified?: boolean;
  label?: string;
  size?: "sm" | "md";
  icon?: "check" | "shield";
  className?: string;
  /** Show a muted "pending" pill instead of nothing when not verified. */
  showPending?: boolean;
  pendingLabel?: string;
}

/**
 * `✓ موثق` — the primary trust signal on the marketplace (§7, §51).
 */
export function VerifiedBadge({
  verified,
  label = "موثق",
  size = "sm",
  icon = "check",
  className,
  showPending = false,
  pendingLabel,
}: VerifiedBadgeProps) {
  const Icon = icon === "shield" ? ShieldCheck : BadgeCheck;
  if (!verified) {
    if (!showPending) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground ring-1 ring-inset ring-border",
          size === "sm" ? "text-[11px]" : "text-xs",
          className
        )}
      >
        {pendingLabel ?? label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700 ring-1 ring-inset ring-brand-200",
        size === "sm" ? "text-[11px]" : "text-xs",
        className
      )}
      title={label}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
      {label}
    </span>
  );
}
