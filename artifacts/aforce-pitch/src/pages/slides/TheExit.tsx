import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import SlideFrame from "@/components/SlideFrame";

const EASE = [0.16, 1, 0.3, 1] as const;

const COMPS = [
  { name: "Prime", v: "$250M+", note: "Revenue in year one", red: true },
  { name: "Liquid I.V.", v: "$500M", note: "Acquired by Unilever", blue: true },
  { name: "BodyArmor", v: "$5.6B", note: "Acquired by Coca-Cola", blue: true },
  { name: "Oatly", v: "$10B+", note: "IPO valuation", blue: true },
];

export default function TheExit() {
  const reduce = useReducedMotion();

  return (
    <SlideFrame slide={21}>
      <div className="absolute inset-0 flex flex-col px-[5vw] pt-[11vh] pb-[9vh]">
        {/* HEADER */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE }}
        >
          <span className="font-display uppercase tracking-[0.32em] text-[0.78vw] text-red font-semibold border-b-2 border-red pb-[0.6vh]">
            The Exit
          </span>
        </motion.div>
        <motion.h1
          className="font-display font-light tracking-[-0.025em] text-[3vw] leading-[1.02] text-text mt-[2.2vh]"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.08 }}
        >
          A prime <span className="text-red font-normal">acquisition target.</span>
        </motion.h1>
        <motion.p
          className="mt-[2vh] max-w-[52vw] font-body text-[1.0vw] leading-[1.5] text-text/65"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.6, ease: EASE, delay: 0.18 }}
        >
          Strategic acquirers pay premiums for brands that own a behavior. The premium hydration
          category has produced repeated billion-dollar outcomes.
        </motion.p>

        {/* COMP GRID */}
        <div className="flex-1 grid grid-cols-4 gap-[1.6vw] mt-[4vh] min-h-0">
          {COMPS.map((c, i) => (
            <motion.div
              key={c.name}
              className="flex flex-col justify-between rounded-[0.6vw] border border-text/15 px-[1.4vw] py-[2vh]"
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.3 + i * 0.08 }
              }
            >
              <span className="font-display uppercase tracking-[0.2em] text-[0.66vw] text-text/50 font-semibold">
                {c.name}
              </span>
              <span
                className={`font-display text-[2.6vw] leading-[1.0] tabular-nums mt-[1.5vh] ${
                  c.blue ? "text-blue" : c.red ? "text-red" : "text-text"
                } ${c.blue || c.red ? "font-normal" : "font-light"}`}
              >
                {c.v}
              </span>
              <span className="font-body text-[0.72vw] text-text/55 leading-[1.4] mt-[1.2vh]">
                {c.note}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-[3vh] flex items-center gap-[1vw]"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? undefined : { duration: 0.5, ease: EASE, delay: 0.7 }}
        >
          <span className="h-[2px] w-[3vw] bg-blue" />
          <span className="font-display text-[1.1vw] font-light text-text leading-[1.3]">
            AForce is built to become the next name on this list.
          </span>
        </motion.div>

        <div className="mx-auto max-w-[70vw] text-center font-body italic text-[#aaa] text-[0.58vw] tracking-[0.05em] leading-[1.4] mt-[2vh]">
          Comparable-company figures are publicly reported third-party outcomes shown for context
          only. They are not a prediction or guarantee of any AForce outcome.
        </div>
      </div>
    </SlideFrame>
  );
}
