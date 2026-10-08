import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-border bg-secondary px-1.5 font-mono text-[11px] font-medium text-muted-foreground [box-shadow:0_1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}
