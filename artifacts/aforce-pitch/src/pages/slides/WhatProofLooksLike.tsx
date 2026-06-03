import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const PROOFS = [
  "Day 30 retention holds above 50%.",
  "OS activation clears 50% of buyers.",
  "Members log three or more engagements every week.",
  "Ritual adoption compounds week over week.",
  "Weekly active users grow without paid lift.",
];

export default function WhatProofLooksLike() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={14}>
      <div className="absolute inset-0 flex flex-col justify-center px-[5vw] pt-[12vh] pb-[10vh]">
        {/* eyebrow */}
        <motion.div
          className="mb-[3.5vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Proof
          </span>
        </motion.div>

        {/* headline */}
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[4.2vw] leading-[1.02] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          What proof looks like.
        </motion.h1>

        {/* decision logic */}
        <motion.p
          className="mt-[5vh] font-display font-light tracking-[-0.01em] text-[2vw] leading-[1.2] text-text max-w-[62vw]"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.22 }}
        >
          If these are true by{" "}
          <span className="text-red font-normal">January 2027</span>, the model
          is proven.
        </motion.p>

        {/* binary proof points */}
        <div className="mt-[5vh] grid grid-cols-1 gap-[1.8vh] max-w-[64vw]">
          {PROOFS.map((p, i) => (
            <motion.div
              key={p}
              className="flex items-baseline gap-[1.4vw] border-t border-text/12 pt-[1.6vh]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.4 + i * 0.08 }
              }
            >
              <span className="font-display tabular-nums tracking-[0.1em] text-[0.9vw] text-red font-semibold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-body text-[1.15vw] leading-[1.3] text-text/85">
                {p}
              </span>
            </motion.div>
          ))}
        </div>

        {/* closing statement */}
        <motion.div
          className="mt-[4.5vh] flex items-center gap-[1vw]"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.84 }}
        >
          <span className="w-[2.2vw] h-[2px] bg-red" />
          <span className="font-display uppercase tracking-[0.28em] text-[0.72vw] text-text font-semibold">
            Binary. Measurable. Proven before we scale.
          </span>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
