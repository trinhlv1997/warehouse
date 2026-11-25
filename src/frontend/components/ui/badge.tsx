import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../utils/cn";

export const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-primary-soft text-primary",
      success: "bg-success-soft text-green-800",
      warning: "bg-warning-soft text-orange-800",
      caution: "bg-caution-soft text-yellow-800",
      danger: "bg-danger-soft text-red-800",
      muted: "bg-muted text-muted-foreground",
      outline: "border border-border text-foreground",
      navy: "bg-sidebar text-white",
    },
  },
  defaultVariants: { variant: "default" },
});

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
