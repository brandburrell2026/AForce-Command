import { Fragment } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const STEPS: Array<{ w: string; d: string }> = [
  { w: "Product", d: "Entry point" },
  { w: "Ritual", d: "Behavior formed" },
  { w: "Behavior", d: "Habit locked" },
  { w: "OS", d: "Data compounds" },
  { w: "Retention", d: "Churn eliminated" },
  { w: "Membership", d: "Revenue recurring" },
  { w: "Scale", d: "Moat permanent" },
];

export default function TheFramework() {
  const reduce = useReducedMotion();
  const last = STEPS.length - 1;

  return (
    <SlideFrame slide={11}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[14vh] pb-[12vh]">
        {/* header */}
        <motion.div
          className="mb-[3.5vh]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Framework
          </span>
        </motion.div>

        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3.6vw] leading-[1.04] text-text"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          Seven steps.{" "}
          <span className="text-red font-normal">One compounding system.</span>
        </motion.h1>

        {/* the chain — words connected by arrows, each with a quiet descriptor */}
        <div className="flex flex-1 items-center">
          <div className="flex w-full items-start justify-between">
            {STEPS.map((s, i) => (
              <Fragment key={s.w}>
                <motion.div
                  className="flex flex-col items-center text-center"
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.22 + i * 0.08 }
                  }
                >
                  <span className="font-display uppercase tracking-[0.1em] text-[1.2vw] text-text font-normal leading-none">
                    {s.w}
                  </span>
                  <span className="mt-[1.6vh] font-body uppercase tracking-[0.2em] text-[0.6vw] text-text/45 font-medium whitespace-nowrap">
                    {s.d}
                  </span>
                </motion.div>
                {i < last && (
                  <motion.span
                    aria-hidden
                    className="font-display text-[1.1vw] text-text/25 leading-none"
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={
                      reduce ? undefined : { duration: 0.4, ease: EASE, delay: 0.26 + i * 0.08 }
                    }
                  >
                    →
                  </motion.span>
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {/* the law */}
        <motion.div
          className="text-center font-body italic text-text/55 text-[0.95vw] tracking-[0.04em]"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.9 }}
        >
          Each step earns the next. None can be skipped.
        </motion.div>
      </div>
    </SlideFrame>
  );
}
