import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="page-shell py-6 sm:py-8" aria-busy="true">
      <Skeleton className="h-4 w-64" />
      <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="mt-8 h-6 w-48" />
          <Skeleton className="mt-4 h-24 w-full rounded-xl" />
          <Skeleton className="mt-4 h-24 w-full rounded-xl" />
          <Skeleton className="mt-10 h-6 w-48" />
          <Skeleton className="mt-4 h-40 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
