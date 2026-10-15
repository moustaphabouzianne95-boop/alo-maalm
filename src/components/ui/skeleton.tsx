import { cn } from "@/lib/utils";

/** Layout-stable placeholder used while server data streams in. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative overflow-hidden rounded-md bg-muted", className)} {...props}>
    <span aria-hidden className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-background/60 to-transparent rtl:translate-x-full" />
  </div>;
}

export { Skeleton };
