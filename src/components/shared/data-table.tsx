"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { useI18n } from "@/lib/i18n/provider";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  /** Return a string for sorting/search, or a node for rich cells. */
  cell: (row: T, index: number) => React.ReactNode;
  /** Plain-text projection used by client-side sorting. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
  sortable?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  headerClassName?: string;
  /** Rendered first on the mobile card layout. */
  primary?: boolean;
  /** Hidden below this breakpoint (Tailwind class fragment). */
  hideBelow?: "sm" | "md" | "lg" | "xl";
}

export type SortDirection = "asc" | "desc";

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  /** Optional right-hand action cell per row. */
  renderRowActions?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string | undefined;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  /** Server-side pagination: pass totals and let the parent control the page. */
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  pageHrefFor?: (page: number) => string;
  /** Client-side sorting. Disable when the server sorts. */
  clientSorting?: boolean;
  initialSort?: { id: string; direction: SortDirection };
  caption?: string;
  className?: string;
  dense?: boolean;
}

const HIDE_CLASS: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

/**
 * Reusable data table (§43): sortable headers, server- or client-side
 * pagination, skeleton loading, empty state, row actions and a mobile card
 * layout so no table ever overflows a phone screen.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 6,
  emptyTitle,
  emptyDescription,
  emptyAction,
  renderRowActions,
  onRowClick,
  rowHref,
  toolbar,
  footer,
  page,
  totalPages,
  total,
  perPage,
  onPageChange,
  pageHrefFor,
  clientSorting = false,
  initialSort,
  caption,
  className,
  dense = false,
}: DataTableProps<T>) {
  const { t, locale } = useI18n();
  const [sort, setSort] = React.useState<{ id: string; direction: SortDirection } | null>(initialSort ?? null);

  const sorted = React.useMemo(() => {
    if (!clientSorting || !sort) return data;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return data;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = column.sortValue?.(a);
      const bv = column.sortValue?.(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * factor;
      return String(av).localeCompare(String(bv), "ar") * factor;
    });
  }, [clientSorting, sort, data, columns]);

  function toggleSort(column: DataTableColumn<T>) {
    if (!clientSorting || !column.sortable) return;
    setSort((prev) => {
      if (prev?.id !== column.id) return { id: column.id, direction: "asc" };
      if (prev.direction === "asc") return { id: column.id, direction: "desc" };
      return null;
    });
  }

  const pad = dense ? "px-3 py-2" : "px-4 py-3";
  const hasRows = sorted.length > 0;

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar}

      {/* ── Desktop / tablet: real table ─────────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-soft md:block">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="border-b bg-muted/40">
              <tr>
                {columns.map((column) => {
                  const isSorted = sort?.id === column.id;
                  const Icon = isSorted ? (sort?.direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={isSorted ? (sort?.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={cn(
                        pad,
                        "text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        column.align === "center" && "text-center",
                        column.align === "end" && "text-end",
                        column.hideBelow && HIDE_CLASS[column.hideBelow],
                        column.headerClassName
                      )}
                    >
                      {column.sortable && clientSorting ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {column.header}
                          <Icon className={cn("h-3 w-3", !isSorted && "opacity-40")} aria-hidden />
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {renderRowActions && (
                  <th scope="col" className={cn(pad, "text-end text-xs font-semibold uppercase tracking-wide text-muted-foreground")}>
                    <span className="sr-only">{t("common.actions")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                    <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                      {columns.map((column, colIndex) => (
                        <td key={column.id} className={cn(pad, column.hideBelow && HIDE_CLASS[column.hideBelow])}>
                          <Skeleton className={cn("h-4", colIndex === 0 ? "w-40" : "w-24")} />
                        </td>
                      ))}
                      {renderRowActions && (
                        <td className={pad}>
                          <Skeleton className="ms-auto h-4 w-10" />
                        </td>
                      )}
                    </tr>
                  ))
                : sorted.map((row, index) => {
                    const href = rowHref?.(row);
                    const clickable = Boolean(onRowClick || href);
                    const primaryColumn = columns.find((c) => c.primary);
                    return (
                      <tr
                        key={rowKey(row, index)}
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        className={cn("transition-colors hover:bg-muted/40", clickable && "cursor-pointer")}
                      >
                        {columns.map((column) => {
                          const isPrimary = column === primaryColumn;
                          const cell = column.cell(row, index);
                          return (
                            <td
                              key={column.id}
                              className={cn(
                                pad,
                                "align-middle text-foreground",
                                column.align === "center" && "text-center",
                                column.align === "end" && "text-end",
                                column.hideBelow && HIDE_CLASS[column.hideBelow],
                                column.className
                              )}
                            >
                              {href && isPrimary ? (
                                <a
                                  href={href}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded font-medium text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  {cell}
                                </a>
                              ) : (
                                cell
                              )}
                            </td>
                          );
                        })}
                        {renderRowActions && (
                          <td className={cn(pad, "text-end")} onClick={(e) => e.stopPropagation()}>
                            {renderRowActions(row)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>

        {!loading && !hasRows && (
          <EmptyState
            className="border-0 border-t"
            icon={<Inbox />}
            title={emptyTitle ?? t("admin.empty.generic")}
            description={emptyDescription}
            action={emptyAction}
          />
        )}
      </div>

      {/* ── Mobile: stacked cards ────────────────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={`m-skeleton-${i}`} className="space-y-2 rounded-2xl border bg-card p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          : sorted.map((row, index) => {
              const primary = columns.find((c) => c.primary) ?? columns[0];
              const rest = columns.filter((c) => c !== primary);
              const href = rowHref?.(row);
              return (
                <article
                  key={rowKey(row, index)}
                  className={cn("rounded-2xl border bg-card p-4 shadow-soft", (href || onRowClick) && "active:bg-muted/40")}
                >
                  {primary && (
                    <div className="mb-2 text-sm font-semibold">
                      {href ? (
                        <a href={href} className="hover:text-primary hover:underline">
                          {primary.cell(row, index)}
                        </a>
                      ) : (
                        primary.cell(row, index)
                      )}
                    </div>
                  )}
                  <dl className="space-y-1.5">
                    {rest.map((column) => (
                      <div key={column.id} className="flex items-start justify-between gap-3 text-xs">
                        <dt className="shrink-0 text-muted-foreground">{column.header}</dt>
                        <dd className={cn("text-end font-medium", column.align === "end" && "text-end")}>{column.cell(row, index)}</dd>
                      </div>
                    ))}
                  </dl>
                  {renderRowActions && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3">{renderRowActions(row)}</div>
                  )}
                </article>
              );
            })}

        {!loading && !hasRows && (
          <EmptyState
            compact
            icon={<Inbox />}
            title={emptyTitle ?? t("admin.empty.generic")}
            description={emptyDescription}
            action={emptyAction}
          />
        )}
      </div>

      {(totalPages || total) && !loading && (
        <Pagination
          page={page ?? 1}
          totalPages={totalPages ?? 1}
          total={total}
          perPage={perPage}
          onChange={onPageChange}
          hrefFor={pageHrefFor}
          locale={locale}
        />
      )}
      {footer}
    </div>
  );
}
