import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const ALLOCATION = [
  { pct: 40, label: "Inventory & Production", body: "Build inventory for retail expansion.", color: "var(--color-red)" },
  { pct: 20, label: "Sales & Distribution", body: "Retail placement and channel development.", color: "var(--color-blue)" },
  { pct: 15, label: "Marketing & Brand Growth", body: "Customer acquisition and awareness.", color: "#0b0d12" },
  { pct: 10, label: "Team & Operations", body: "Strategic hires and execution support.", color: "rgba(11,13,18,0.55)" },
  { pct: 10, label: "Working Capital", body: "Operational flexibility and scaling.", color: "rgba(11,13,18,0.32)" },
  { pct: 5, label: "Legal, Compliance & IP", body: "Protecting the brand and intellectual property.", color: "rgba(11,13,18,0.18)" },
];

export default function UseOfFunds() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={18}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            Use of Funds
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          How capital will be <span className="text-red font-normal">deployed.</span>
        </motion.h1>
        <motion.p
          className="mt-[2vh] max-w-[54vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          Focused investment designed to accelerate growth, distribution, and revenue.
        </motion.p>

        {/* SEGMENTED BAR */}
        <motion.div
          className="flex w-full h-[6.5vh] rounded-[0.4vw] overflow-hidden mt-[3.6vh]"
          initial={reduce ? false : { opacity: 0, scaleX: 0.96 }}
          animate={{ opacity: 1, scaleX: 1 }}
          style={{ transformOrigin: "left" }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.28 }}
        >
          {ALLOCATION.map((a, i) => (
            <div
              key={a.label}
              className="flex items-center justify-center"
              style={{ width: `${a.pct}%`, background: a.color }}
            >
              <span
                className={`font-display text-[0.85vw] font-semibold tabular-nums ${
                  i < 3 ? "text-bg" : "text-bg/85"
                }`}
              >
                {a.pct}%
              </span>
            </div>
          ))}
        </motion.div>

        {/* LEGEND GRID */}
        <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-x-[2.4vw] gap-y-[1.4vh] mt-[3vh] min-h-0">
          {ALLOCATION.map((a, i) => (
            <motion.div
              key={a.label}
              className="flex flex-col border-t border-text/15 pt-[1.2vh]"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduce ? undefined : { duration: 0.45, ease: EASE, delay: 0.4 + i * 0.06 }}
            >
              <div className="flex items-baseline gap-[0.7vw]">
                <span
                  className="h-[0.7vw] w-[0.7vw] rounded-full shrink-0 self-center"
                  style={{ background: a.color }}
                />
                <span className="font-display text-[1.5vw] font-light text-text tabular-nums leading-none">
                  {a.pct}%
                </span>
              </div>
              <span className="font-display text-[0.92vw] font-normal text-text leading-[1.2] mt-[1vh]">
                {a.label}
              </span>
              <span className="font-body text-[0.72vw] text-text/55 leading-[1.35] mt-[0.5vh]">
                {a.body}
              </span>
            </motion.div>
          ))}
        </div>

        <div className="mx-auto max-w-[62vw] text-center font-display text-[1.0vw] font-light text-text/75 leading-[1.4] mt-[2vh]">
          Every dollar is deployed toward accelerating revenue growth and expanding market reach.
        </div>
      </div>
    </SlideFrame>
  );
}
