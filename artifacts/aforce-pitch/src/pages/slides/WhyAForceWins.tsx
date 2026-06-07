import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const COMPETITORS = [
  { brand: "Gatorade", owns: "Sports Performance" },
  { brand: "Liquid I.V.", owns: "Functional Hydration" },
  { brand: "LMNT", owns: "Electrolytes" },
  { brand: "AG1", owns: "Daily Wellness Ritual" },
  { brand: "WHOOP", owns: "Recovery & Readiness" },
];

const ATTRIBUTES = ["Preparation", "Discipline", "Recovery", "Consistency", "Readiness"];

export default function WhyAForceWins() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={16}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
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
          className="mt-[2vh] max-w-[54vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          The next generation of performance is not about intensity. It is about readiness.
        </motion.p>

        {/* COMPETITOR ROW */}
        <div className="grid grid-cols-5 gap-[1.2vw] mt-[3.6vh]">
          {COMPETITORS.map((c, i) => (
            <motion.div
              key={c.brand}
              className="flex flex-col rounded-[0.5vw] border border-text/15 px-[1vw] py-[1.6vh]"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.28 + i * 0.06 }}
            >
              <span className="font-display text-[1.05vw] font-normal text-text/85 leading-none">
                {c.brand}
              </span>
              <span className="font-display uppercase tracking-[0.06em] text-[0.5vw] text-text/40 font-medium mt-[1vh]">
                owns
              </span>
              <span className="font-body text-[0.74vw] text-text/60 leading-[1.3] mt-[0.4vh]">
                {c.owns}
              </span>
            </motion.div>
          ))}
        </div>

        {/* AFORCE HIGHLIGHT BLOCK */}
        <motion.div
          className="flex-1 flex flex-col justify-center rounded-[0.6vw] bg-black px-[2.6vw] py-[2.4vh] mt-[2.6vh] min-h-0"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.55, ease: EASE, delay: 0.62 }}
        >
          <span className="font-display uppercase tracking-[0.22em] text-[0.62vw] text-bg/45 font-medium">
            AForce owns
          </span>
          <span className="font-display font-light tracking-[-0.02em] text-[2.8vw] leading-[1.0] text-red mt-[0.8vh]">
            Quiet Performance™
          </span>
          <div className="flex flex-wrap gap-x-[2vw] gap-y-[1vh] mt-[2.2vh]">
            {ATTRIBUTES.map((a) => (
              <span
                key={a}
                className="font-display uppercase tracking-[0.16em] text-[0.78vw] text-bg/80 font-medium"
              >
                {a}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="mx-auto max-w-[60vw] text-center font-display text-[1.0vw] font-light text-text/75 leading-[1.4] mt-[2.6vh]">
          The future of performance is not more stimulation. It is{" "}
          <span className="text-red font-normal">better preparation.</span>
        </div>
      </div>
    </SlideFrame>
  );
}
