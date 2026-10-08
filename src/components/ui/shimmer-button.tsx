import React, { type ComponentPropsWithoutRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

export interface ShimmerButtonProps extends ComponentPropsWithoutRef<"button"> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
}

/** Hero-grade CTA with an orbiting spark. Use sparingly: one per screen. */
export function ShimmerButton({
  shimmerColor = "oklch(1 0 0 / 0.9)",
  shimmerSize = "0.05em",
  shimmerDuration = "3s",
  borderRadius = "0.75rem",
  background = "var(--primary)",
  className,
  children,
  ref,
  ...props
}: ShimmerButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return (
    <button
      style={
        {
          "--spread": "90deg",
          "--shimmer-color": shimmerColor,
          "--radius": borderRadius,
          "--speed": shimmerDuration,
          "--cut": shimmerSize,
          "--bg": background,
        } as CSSProperties
      }
      className={cn(
        "group relative z-0 inline-flex h-12 cursor-pointer items-center justify-center gap-2 overflow-hidden whitespace-nowrap border border-white/10 px-6 text-base font-medium text-primary-foreground outline-none [background:var(--bg)] [border-radius:var(--radius)]",
        "transform-gpu transition-transform duration-150 ease-out-strong focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    >
      {/* spark container */}
      <div className="-z-30 blur-[2px] @container-[size] absolute inset-0 overflow-visible motion-reduce:hidden">
        <div className="animate-shimmer-slide absolute inset-0 aspect-[1] h-[100cqh] rounded-none [mask:none]">
          <div className="animate-spin-around absolute -inset-full w-auto [translate:0_0] rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))]" />
        </div>
      </div>
      {children}
      {/* highlight */}
      <div className="absolute inset-0 size-full transform-gpu rounded-[inherit] shadow-[inset_0_-8px_10px_#ffffff1f] transition-shadow duration-300 ease-in-out group-hover:shadow-[inset_0_-6px_10px_#ffffff3f] group-active:shadow-[inset_0_-10px_10px_#ffffff3f]" />
      {/* backdrop */}
      <div className="absolute inset-(--cut) -z-20 [background:var(--bg)] [border-radius:var(--radius)]" />
    </button>
  );
}
