"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function Progress({
  className,
  value = 0,
  tone = "primary",
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { tone?: Tone }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={pct}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full origin-left rounded-full transition-transform duration-500 ease-out-strong",
          toneClass[tone],
        )}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </ProgressPrimitive.Root>
  );
}
