import * as React from "react";

import { cn } from "@/lib/utils";

interface StatProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** A string/number, or a <NumberTicker /> for animated counts. */
  value: React.ReactNode;
  /** Small secondary text under the value (e.g. "of 1,200 images"). */
  detail?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Metric block. Not boxed on its own; compose inside Card or a divided grid. */
export function Stat({ label, value, detail, icon, className, ...props }: StatProps) {
  return (
    <div data-slot="stat" className={cn("flex flex-col gap-1", className)} {...props}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {detail && <div className="text-sm text-muted-foreground">{detail}</div>}
    </div>
  );
}
