import * as React from "react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "./status-config";
import { toneClasses } from "./status-config";

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  /** Small delta line, e.g. "+12% ce mois-ci". */
  delta?: { value: React.ReactNode; positive?: boolean };
  tone?: StatusTone;
  href?: string;
  className?: string;
  loading?: boolean;
}

/** Dashboard KPI card used identically in all three dashboards (§21–23). */
export function StatCard({ label, value, icon, hint, delta, tone = "info", href, className, loading }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <span className="block h-8 w-16 animate-pulse rounded bg-muted" aria-hidden />
          ) : (
            <p className="text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
          )}
        </div>
        {icon && (
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl [&_svg]:h-5 [&_svg]:w-5", toneClasses(tone))} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      {(delta || hint) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {delta && (
            <span className={cn("font-semibold tabular-nums", delta.positive === false ? "text-destructive" : "text-brand-600")}>
              {delta.value}
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      )}
    </>
  );

  const base = cn("rounded-2xl border bg-card p-5 shadow-soft transition-shadow", className);

  if (href) {
    return (
      <a href={href} className={cn(base, "hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>
        {body}
      </a>
    );
  }
  return <div className={base}>{body}</div>;
}
