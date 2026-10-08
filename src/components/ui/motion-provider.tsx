"use client";

import { MotionConfig } from "motion/react";

/** Wraps the app so every motion component honors prefers-reduced-motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
