import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-musiva-info/20 bg-musiva-info/10 text-musiva-info",
        success: "border-musiva-sage/20 bg-musiva-sage/10 text-musiva-sage",
        warning: "border-musiva-warning/25 bg-musiva-warning/10 text-musiva-warning-foreground",
        danger: "border-musiva-danger/20 bg-musiva-danger/10 text-musiva-danger",
        outline: "text-foreground",
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
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
