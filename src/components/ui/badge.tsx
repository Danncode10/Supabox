import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        neutral: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        success: "border-transparent bg-success/14 text-success",
        warning: "border-transparent bg-warning/14 text-warning",
        danger: "border-transparent bg-danger/14 text-danger",
        info: "border-transparent bg-info/14 text-info",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export interface BadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  /** Renders a small status dot before the label. */
  dot?: boolean;
  /** Pulses the dot (live/in-progress states). */
  pulse?: boolean;
}

export function Badge({ className, variant, dot, pulse, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full bg-current", pulse && "animate-pulse-dot")}
        />
      )}
      {children}
    </span>
  );
}
