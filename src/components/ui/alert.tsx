import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-0.5 rounded-lg border px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-info/25 bg-info/8 text-foreground [&>svg]:text-info",
        success: "border-success/25 bg-success/8 text-foreground [&>svg]:text-success",
        warning: "border-warning/25 bg-warning/8 text-foreground [&>svg]:text-warning",
        danger: "border-danger/25 bg-danger/8 text-foreground [&>svg]:text-danger",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
} as const;

/** Inline, toast-free feedback. Use `danger` for errors (announced via role=alert). */
export function Alert({
  className,
  variant = "info",
  children,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  const Icon = icons[variant ?? "info"];
  return (
    <div
      role={variant === "danger" || variant === "warning" ? "alert" : "status"}
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4" aria-hidden />
      <div className="col-start-2 flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-medium leading-snug", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-description" className={cn("text-muted-foreground", className)} {...props} />
  );
}
