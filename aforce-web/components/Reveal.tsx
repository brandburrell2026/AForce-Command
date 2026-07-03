"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Delay in seconds. */
  delay?: number;
  /** "up" (default) rises + fades; "fade" only fades; "blur" fades from blur. */
  variant?: "up" | "fade" | "blur";
  className?: string;
  as?: "div" | "section" | "li" | "span";
  amount?: number;
};

/**
 * Scroll-triggered reveal. Subtle, expensive-feeling — no bounce.
 * Honors prefers-reduced-motion (renders immediately, no transform).
 */
export default function Reveal({
  children,
  delay = 0,
  variant = "up",
  className,
  as = "div",
  amount = 0.3,
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: variant === "up" ? 34 : 0,
      filter: variant === "blur" ? "blur(14px)" : "blur(0px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        duration: 0.9,
        delay,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </MotionTag>
  );
}
