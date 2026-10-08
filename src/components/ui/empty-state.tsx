import * as React from "react";

import { cn } from "@/lib/utils";
import { GridPattern } from "@/components/ui/grid-pattern";

interface EmptyStateProps extends Omit<React.ComponentProps<"div">, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Primary call-to-action(s), typically a Button. */
  action?: React.ReactNode;
}

/** Composed empty state: tells the user what is missing and how to fill it. */
export function EmptyState({ icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "relative flex flex-col items-center gap-3 overflow-hidden rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
      {...props}
    >
      <GridPattern
        width={32}
        height={32}
        className="mask-[radial-gradient(240px_circle_at_center,white,transparent)] fill-transparent stroke-foreground/6"
      />
      {icon && (
        <div className="relative grid size-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground [box-shadow:var(--inset-highlight),var(--elev-sm)] [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="relative flex max-w-sm flex-col gap-1">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="relative mt-2 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
