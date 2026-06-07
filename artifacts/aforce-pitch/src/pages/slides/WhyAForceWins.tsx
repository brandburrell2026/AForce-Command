import { Fragment } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const COMPETITORS = [
  { brand: "Gatorade", owns: "Sports Performance" },
  { brand: "Liquid I.V.", owns: "Functional Hydration" },
  { brand: "LMNT", owns: "Electrolytes" },
  { brand: "AG1", owns: "Daily Wellness" },
  { brand: "WHOOP", owns: "Recovery & Readiness" },
];

const ATTRIBUTES = ["Preparation", "Discipline", "Recovery", "Consistency", "Readiness"];

export default function WhyAForceWins() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={15}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[10vh] pb-[8.5vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Why AForce Wins
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Why AForce <span className="text-red font-normal">wins.</span>
        </motion.h1>
        <motion.p
          className="mt-[1.8vh] max-w-[56vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          Every brand in the category competes for attention. AForce competes for composure.
        </motion.p>

        {/* COMPETITOR STRIP — they each own one lane */}
        <div className="mt-[3.2vh]">
          <motion.span
            className="block font-display uppercase tracking-[0.22em] text-[0.6vw] text-text/40 font-medium"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.26 }}
          >
            They each own one lane
          </motion.span>
          <div className="grid grid-cols-5 gap-[1.2vw] mt-[1.4vh]">
            {COMPETITORS.map((c, i) => (
              <motion.div
                key={c.brand}
                className="flex flex-col border-t border-text/25 pt-[1.1vh]"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.32 + i * 0.06 }}
              >
                <span className="font-display text-[1.0vw] font-normal text-text/80 leading-none">
                  {c.brand}
                </span>
                <span className="font-body text-[0.7vw] text-text/45 leading-[1.3] mt-[0.7vh]">
                  {c.owns}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* AFORCE HERO BLOCK */}
        <motion.div
          className="relative flex-1 overflow-hidden rounded-[0.7vw] bg-black mt-[3.2vh] min-h-0 flex flex-col items-center justify-center text-center px-[4vw]"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.66 }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(58% 80% at 50% 32%, rgba(228,30,43,0.22) 0%, rgba(228,30,43,0) 70%)",
            }}
          />
          <span className="relative font-display uppercase tracking-[0.34em] text-[0.66vw] text-cream/45 font-medium">
            AForce owns
          </span>
          <span className="relative font-display font-light tracking-[-0.02em] text-[3.7vw] leading-[0.98] text-red mt-[1.4vh]">
            Quiet Performance™
          </span>
          <div className="relative flex items-center justify-center gap-[1.4vw] mt-[3vh]">
            {ATTRIBUTES.map((a, i) => (
              <Fragment key={a}>
                <span className="font-display uppercase tracking-[0.18em] text-[0.82vw] text-cream/85 font-medium">
                  {a}
                </span>
                {i < ATTRIBUTES.length - 1 && (
                  <span className="h-[0.45vh] w-[0.45vh] rounded-full bg-red/70 shrink-0" />
                )}
              </Fragment>
            ))}
          </div>
          <span className="relative font-body text-[0.86vw] text-cream/55 leading-[1.5] mt-[3vh] max-w-[46vw]">
            The behaviors that compound into elite performance. While the category fights for
            attention, AForce owns the moment before execution.
          </span>
        </motion.div>
      </div>
    </SlideFrame>
  );
}
