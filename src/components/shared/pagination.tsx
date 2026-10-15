import type { Key, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DEFAULT_LOCALE, LOCALE_TAG, type LangCode } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  /** With `perPage`, renders the "showing X–Y of Z" summary line. */
  total?: number;
  perPage?: number;
  /** URL mode: server-driven lists keep every filter in the query string. */
  hrefFor?: (page: number) => string;
  /** Callback mode: client-driven tables (TanStack Query) control the page. */
  onChange?: (page: number) => void;
  /** Active UI language. Optional so client callers can omit it (Arabic default). */
  locale?: LangCode;
  className?: string;
}

/**
 * Pagination (§52) — deliberately a *plain* module with no `"use client"` and
 * no hooks: server pages render it with `hrefFor` (links, zero JS), and client
 * components such as the DataTable import the same module with `onChange`.
 * Event handlers only ever appear in the `onChange` branch, which server
 * callers never trigger.
 */

/** Compact window: 1 … 4 [5] 6 … 20 — never renders hundreds of links. */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) {
    [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  }
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  hrefFor,
  onChange,
  locale = DEFAULT_LOCALE,
  className,
}: PaginationProps) {
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const nf = new Intl.NumberFormat(LOCALE_TAG[locale]);

  const showSummary = total != null && perPage != null && total > 0;
  const interactive = Boolean(hrefFor || onChange);

  if (totalPages <= 1 && !showSummary) return null;

  const from = total != null && total > 0 ? (page - 1) * (perPage ?? total) + 1 : 0;
  const to = total != null ? Math.min(total, page * (perPage ?? total)) : 0;

  const controlClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors";
  const idleClass = cn(controlClass, "border-input bg-background hover:bg-accent");
  const disabledClass = cn(controlClass, "pointer-events-none border-input bg-muted/40 text-muted-foreground/50");
  const currentClass = cn(controlClass, "border-transparent bg-primary text-primary-foreground shadow-sm");

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const renderControl = (target: number, content: ReactNode, key: Key, ariaLabel?: string) => {
    if (hrefFor) {
      return (
        <Link key={key} href={hrefFor(target)} className={idleClass} aria-label={ariaLabel}>
          {content}
        </Link>
      );
    }
    return (
      <button key={key} type="button" onClick={() => onChange?.(target)} className={idleClass} aria-label={ariaLabel}>
        {content}
      </button>
    );
  };

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {showSummary ? (
        <p className="text-xs text-muted-foreground">
          {t("common.showing", { from: nf.format(from), to: nf.format(to), total: nf.format(total ?? 0) })}
        </p>
      ) : null}

      {interactive && totalPages > 1 ? (
        <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label={t("common.page")}>
          {hasPrev ? (
            renderControl(
              page - 1,
              <>
                <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
                <span className="sr-only sm:not-sr-only sm:ms-1">{t("common.previous")}</span>
              </>,
              "prev",
              t("common.previous")
            )
          ) : (
            <span className={disabledClass}>
              <ChevronRight className="h-4 w-4 rotate-180 rtl:rotate-0" aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ms-1">{t("common.previous")}</span>
            </span>
          )}

          {pageWindow(page, totalPages).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-sm text-muted-foreground" aria-hidden>
                …
              </span>
            ) : entry === page ? (
              <span key={entry} aria-current="page" className={currentClass}>
                {entry}
              </span>
            ) : (
              renderControl(entry, entry, entry, `${t("common.page")} ${entry}`)
            )
          )}

          {hasNext ? (
            renderControl(
              page + 1,
              <>
                <span className="sr-only sm:not-sr-only sm:me-1">{t("common.next")}</span>
                <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </>,
              "next",
              t("common.next")
            )
          ) : (
            <span className={disabledClass}>
              <span className="sr-only sm:not-sr-only sm:me-1">{t("common.next")}</span>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
