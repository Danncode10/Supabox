import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

interface FieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode;
  /** id of the control this label points to */
  htmlFor: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
}

/** Label above control, hint/error below. Pass `aria-invalid` to the control yourself. */
export function Field({ label, htmlFor, hint, error, children, className, ...props }: FieldProps) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-2", className)} {...props}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
