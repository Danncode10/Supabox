import { type ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export interface AnimatedGradientTextProps extends ComponentPropsWithoutRef<"span"> {
  /** Speed multiplier for the gradient sweep. */
  speed?: number;
  colorFrom?: string;
  colorTo?: string;
}

/** Headline text with a slow moving gradient (primary to foreground by default). */
export function AnimatedGradientText({
  children,
  className,
  speed = 1,
  colorFrom = "var(--primary)",
  colorTo = "var(--foreground)",
  ...props
}: AnimatedGradientTextProps) {
  return (
    <span
      style={
        {
          "--bg-size": `${speed * 300}%`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
        } as React.CSSProperties
      }
      className={cn(
        "animate-gradient inline bg-linear-to-r from-(--color-from) via-(--color-to) to-(--color-from) bg-size-[var(--bg-size)_100%] bg-clip-text text-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
