import { Skeleton } from "@/components/ui/skeleton";
import { CardGridSkeleton } from "@/components/shared/card-grid-skeleton";

export default function Loading() {
  return (
    <div className="page-shell py-8 sm:py-10" aria-busy="true">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="mt-8 h-6 w-48" />
      <CardGridSkeleton count={4} className="mt-4" />
      <Skeleton className="mt-10 h-6 w-48" />
      <CardGridSkeleton count={6} className="mt-4" />
    </div>
  );
}
