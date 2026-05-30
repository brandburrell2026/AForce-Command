import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Opening silence, second beat — pure black, a single white statement.
 * No logo, no badge, no footer, no slide number.
 */
export default function AlwaysOn() {
  const reduce = useReducedMotion();

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0D0D0D] flex items-center justify-center px-[10vw]">
      <motion.h1
        className="font-display font-bold tracking-[-0.02em] text-white text-[4.6vw] leading-[1.08] text-center max-w-[66vw]"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.9, ease: EASE }}
      >
        Built for people who don't get to be off.
      </motion.h1>
    </div>
  );
}
