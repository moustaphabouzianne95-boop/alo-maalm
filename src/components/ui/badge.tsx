import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200",
        warning: "border-transparent bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200",
        info: "border-transparent bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-200",
        muted: "border-transparent bg-muted text-muted-foreground",
        verified: "border-transparent bg-brand-600 text-white",
        gold: "border-transparent bg-gold-500 text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
