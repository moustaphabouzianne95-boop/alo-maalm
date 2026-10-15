import * as React from "react";
import { SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Any node — typically a lucide icon element with its own classes. */
  icon?: React.ReactNode;
  /** Free-form action area: buttons, links, or nothing. */
  action?: React.ReactNode;
  /** Tighter padding for embedding inside cards, tables and popovers. */
  compact?: boolean;
  className?: string;
}

/**
 * Shared empty state (§52): every list view uses the same shape so an empty
 * result never looks like a crash — it explains and offers the next step.
 */
export function EmptyState({ title, description, icon, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className
      )}
    >
      <span
        className={cn(
          "mb-4 flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          compact ? "h-10 w-10" : "h-12 w-12"
        )}
      >
        {icon ?? <SearchX className={compact ? "h-5 w-5" : "h-6 w-6"} aria-hidden />}
      </span>
      <h3 className={cn("font-semibold", compact ? "text-sm" : "text-base")}>{title}</h3>
      {description ? (
        <p className="prose-ma mt-2 max-w-md text-balance">{description}</p>
      ) : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
