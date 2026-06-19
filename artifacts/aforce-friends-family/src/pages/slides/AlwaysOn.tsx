import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Opening silence, second beat — pure black, a single white statement.
 * No logo, no badge, no footer, no slide number.
 */
export default function AlwaysOn() {
  const reduce = useReducedMotion();

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-black flex flex-col items-center justify-center px-[10vw]">
      <motion.h1
        className="font-display font-bold tracking-[-0.02em] text-white text-[4.6vw] leading-[1.08] text-center max-w-[66vw]"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.9, ease: EASE }}
      >
        Built for people who don't get to be off.
      </motion.h1>

      <motion.div
        className="mt-[5.5vh] font-display uppercase tracking-[0.32em] text-[0.92vw] text-white/55 text-center max-w-[70vw] leading-[1.6]"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 0.4 }}
      >
        Founders · Entrepreneurs · Creators · Business Leaders · Surgeons · Medical Professionals · Students · Athletes · High Performers
      </motion.div>

      <motion.div
        className="mt-[2.6vh] font-body italic text-[1.05vw] text-white/40 text-center"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 0.6 }}
      >
        Different environments. Same discipline. Performance is universal.
      </motion.div>

      {/* deck-wide disclaimer — shown once, here on slide 2 */}
      <motion.p
        className="absolute bottom-[3.5vh] left-[10vw] right-[10vw] mx-auto max-w-[72vw] text-center font-body text-[0.6vw] leading-[1.6] tracking-[0.02em] text-white/30"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? undefined : { duration: 0.9, ease: EASE, delay: 1.1 }}
      >
        This presentation is confidential and intended solely for the recipient
        for discussion purposes only. It does not constitute an offer to sell or
        a solicitation of an offer to buy any securities, nor shall it form the
        basis of any contract or investment decision. It contains forward-looking
        statements and projections that involve risks, uncertainties, and
        assumptions; actual results may differ materially. No representation or
        warranty, express or implied, is made as to the accuracy or completeness
        of the information herein, and AForce undertakes no obligation to update
        it. Past performance is not indicative of future results.
      </motion.p>
    </div>
  );
}
