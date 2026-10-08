"use client";

import { useRef } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type MotionProps,
  type UseInViewOptions,
  type Variants,
} from "motion/react";

type MarginType = UseInViewOptions["margin"];

interface BlurFadeProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  variant?: { hidden: { y: number }; visible: { y: number } };
  duration?: number;
  delay?: number;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  /** Wait until scrolled into view. */
  inView?: boolean;
  inViewMargin?: MarginType;
  blur?: string;
}

const getFilter = (v: Variants[string]) => (typeof v === "function" ? undefined : v.filter);

/** Entrance: fade + slight rise + blur resolve. Stagger lists with `delay={i * 0.05}`. */
export function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "up",
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
  ...props
}: BlurFadeProps) {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;

  const axis = direction === "left" || direction === "right" ? "x" : "y";
  const from = direction === "right" || direction === "down" ? -offset : offset;

  const defaultVariants: Variants = {
    hidden: { [axis]: reduced ? 0 : from, opacity: 0, filter: `blur(${reduced ? "0px" : blur})` },
    visible: { [axis]: 0, opacity: 1, filter: "blur(0px)" },
  };
  const combined = variant ?? defaultVariants;

  const hiddenFilter = getFilter(combined.hidden);
  const visibleFilter = getFilter(combined.visible);
  const shouldTransitionFilter =
    hiddenFilter != null && visibleFilter != null && hiddenFilter !== visibleFilter;

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combined}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: [0.23, 1, 0.32, 1],
          ...(shouldTransitionFilter ? { filter: { duration } } : {}),
        }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
