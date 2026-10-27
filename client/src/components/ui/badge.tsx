import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
        secondary:
          "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200",
        destructive:
          "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        success:
          "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        warning:
          "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
        indigo:
          "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
        outline: "border border-slate-200 text-slate-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
