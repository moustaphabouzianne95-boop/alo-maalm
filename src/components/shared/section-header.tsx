import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
  size?: "sm" | "md" | "lg";
}

/** Consistent section heading with an optional right-hand action slot. */
export function SectionHeader({
  title,
  description,
  action,
  icon,
  className,
  as: Tag = "h2",
  size = "md",
}: SectionHeaderProps) {
  const titleSize = size === "lg" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-base" : "text-lg sm:text-xl";
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100 [&_svg]:h-[18px] [&_svg]:w-[18px]" aria-hidden>
            {icon}
          </span>
        )}
        <div className="space-y-1">
          <Tag className={cn("font-bold tracking-tight text-foreground", titleSize)}>{title}</Tag>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
