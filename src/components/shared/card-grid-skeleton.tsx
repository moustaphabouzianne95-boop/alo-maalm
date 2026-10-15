import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Card-grid loading skeleton shared by every list route (§52). */
export function CardGridSkeleton({
  count = 6,
  cardClass = "h-64",
  className,
}: {
  count?: number;
  cardClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)} aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className={cn("rounded-xl", cardClass)} />
      ))}
    </div>
  );
}

/** Header + grid skeleton for list pages with a filter sidebar. */
export function ListPageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="page-shell py-8 sm:py-10" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80" />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-96 rounded-xl lg:block" />
        <div>
          <Skeleton className="h-9 w-full max-w-sm" />
          <CardGridSkeleton count={count} className="mt-4" />
        </div>
      </div>
    </div>
  );
}
