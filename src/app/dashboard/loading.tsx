import { StatGridSkeleton, TableSkeleton } from "@/components/shared/skeletons";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 animate-pulse rounded bg-muted" />
      <StatGridSkeleton count={4} />
      <TableSkeleton rows={6} cols={4} />
    </div>
  );
}
