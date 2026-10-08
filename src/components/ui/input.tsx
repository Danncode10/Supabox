import * as React from "react";

import { cn } from "@/lib/utils";

export const fieldControlClass =
  "w-full min-w-0 rounded-lg border border-input bg-background/40 px-3 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow,background-color] duration-150 ease-out-strong placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-danger/30 md:text-sm";

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClass,
        "h-11 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground md:h-10",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldControlClass, "min-h-24 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

/** Styled native select (keeps platform pickers on mobile). */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(fieldControlClass, "h-11 appearance-none bg-no-repeat pr-9 md:h-10", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b8d95' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}
