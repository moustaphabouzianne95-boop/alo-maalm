import { StatGridSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
