import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Opening silence — pure black, a single white statement, nothing else.
 * No logo, no badge, no footer, no slide number. It should feel like a pause.
 */
export default function NonNegotiable() {
  const reduce = useReducedMotion();

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-[#0D0D0D] flex items-center justify-center px-[10vw]">
      <motion.h1
        className="font-display font-bold tracking-[-0.02em] text-white text-[4.6vw] leading-[1.05] text-center"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.9, ease: EASE }}
      >
        Performance is non-negotiable.
      </motion.h1>
    </div>
  );
}
