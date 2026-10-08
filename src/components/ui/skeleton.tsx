import { cn } from "@/lib/utils";

/** Shimmering placeholder. Size it to match the content it replaces. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-linear-to-r after:from-transparent after:via-foreground/6 after:to-transparent motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}
